import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { fileURLToPath } from "node:url";

let child, port;
before(async () => {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once("error", reject); reservation.listen(0, "127.0.0.1", resolve); });
  port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const preload = "data:text/javascript," + encodeURIComponent('globalThis.fetch = async () => { throw new Error("External network is blocked in security tests"); };');
  child = spawn(process.execPath, ["--import", preload, fileURLToPath(new URL("../server.mjs", import.meta.url))], {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"]
  });
  await new Promise((resolve, reject) => {
    let errors = "";
    const timer = setTimeout(() => reject(new Error("Test server startup timed out")), 5000);
    const fail = error => { clearTimeout(timer); reject(error); };
    child.once("error", fail);
    child.once("exit", () => fail(new Error(`Test server exited: ${errors}`)));
    child.stderr.on("data", data => { errors += String(data).slice(0, 1000); });
    child.stdout.on("data", data => { if (String(data).includes("running at")) { clearTimeout(timer); resolve(); } });
  });
});
after(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise(resolve => child.once("exit", resolve));
    child.kill("SIGTERM"); await exited;
  }
});

const get = (target, headers = {}, method = "GET") => new Promise((resolve, reject) => {
  const request = http.request({ hostname: "127.0.0.1", port, path: target, method, headers, timeout: 5000 }, response => {
    let body = "";
    response.on("data", data => { body += data; });
    response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
  });
  request.once("error", reject); request.once("timeout", () => request.destroy(new Error("HTTP timeout"))); request.end();
});

test("health, static modules and migration page still load with defensive headers", async () => {
  for (const target of ["/api/health", "/", "/migration.html", "/url-security.js"]) {
    const response = await get(target);
    assert.equal(response.status, 200, target);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
  }
  const response = await get("/api/health", { Origin: `http://127.0.0.1:${port}` });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).eiaConfigured, false);
});

test("untrusted hosts, origins and forced refreshes are denied before upstream work", async () => {
  for (const [target, headers] of [
    ["/api/health", { Host: `attacker.example:${port}` }],
    ["/api/monitor?refresh=1", { Origin: "https://attacker.example" }],
    ["/api/monitor", { Origin: "null" }],
    ["/api/health", { "Sec-Fetch-Site": "cross-site" }],
    ["/api/monitor?refresh=1", {}]
  ]) {
    const response = await get(target, headers);
    assert.equal(response.status, 403, target);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  }
});

test("same-origin dashboard refresh still succeeds without real external requests", async () => {
  const response = await get("/api/monitor?refresh=1", { Origin: `http://127.0.0.1:${port}`, "X-World-Monitor-Request": "1" });
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(JSON.parse(response.body).articles));
});

test("POST and preflights are denied, HEAD remains supported", async () => {
  const post = await get("/api/health", {}, "POST");
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, "GET, HEAD");
  assert.equal((await get("/api/health", { Origin: "https://attacker.example" }, "OPTIONS")).status, 403);
  const head = await get("/", {}, "HEAD");
  assert.equal(head.status, 200);
  assert.equal(head.body, "");
});
