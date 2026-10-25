import test from "node:test";
import assert from "node:assert/strict";
import { checkLocalRequest } from "../request-security.mjs";

const request = (headers = {}, extra = {}) => ({
  headers: { host: "localhost:4173", ...headers },
  socket: { localPort: 4173 }, method: "GET", url: "/api/health", ...extra
});

test("local browser and command-line requests remain allowed", () => {
  assert.equal(checkLocalRequest(request()), null);
  assert.equal(checkLocalRequest(request({ origin: "http://localhost:4173" })), null);
  assert.equal(checkLocalRequest(request({ host: "127.0.0.1:4173", origin: "http://127.0.0.1:4173" })), null);
  assert.equal(checkLocalRequest(request({ "x-world-monitor-request": "1" }, { url: "/api/monitor?refresh=1" })), null);
});

test("hostnames used for DNS rebinding and invalid ports are rejected", () => {
  for (const host of ["attacker.example:4173", "localhost.attacker.example:4173", "127.1:4173", "localhost:4174", "localhost:99999", "localhost", "localhost:4173@attacker.example", "localhost:4173/", undefined, ""]) {
    assert.equal(checkLocalRequest(request({ host })).status, 403, String(host));
  }
});

test("foreign, opaque and different-port origins are rejected", () => {
  for (const origin of ["https://attacker.example", "null", "http://localhost:4183", "http://127.0.0.1:4173", "http://localhost:4173/"]) {
    assert.equal(checkLocalRequest(request({ origin })).status, 403, origin);
  }
});

test("cross-site subresources and API document navigations are rejected", () => {
  assert.equal(checkLocalRequest(request({ "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal(checkLocalRequest(request({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" })).status, 403);
  assert.equal(checkLocalRequest(request({ "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }, { url: "/" })), null);
});

test("refresh requires a non-safelisted header and unsupported methods are blocked", () => {
  assert.equal(checkLocalRequest(request({}, { url: "/api/monitor?refresh=1" })).status, 403);
  assert.equal(checkLocalRequest(request({}, { method: "POST" })).status, 405);
  assert.equal(checkLocalRequest(request({}, { method: "OPTIONS" })).status, 405);
  assert.equal(checkLocalRequest(request({}, { method: "HEAD" })), null);
  assert.equal(checkLocalRequest(request({}, { url: "http://attacker.example/api/health" })).status, 400);
  assert.equal(checkLocalRequest(request({}, { url: "//attacker.example/api/health" })).status, 400);
});
