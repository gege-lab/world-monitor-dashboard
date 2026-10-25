import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { safeExternalUrl, safeMarkdownUrl } from "../public/url-security.js";

test("HTTP and HTTPS news links remain usable", () => {
  for (const [input, expected] of [
    ["https://example.com/news?a=1&b=2", "https://example.com/news?a=1&b=2"],
    ["http://example.com/article", "http://example.com/article"],
    [" HTTPS://EXAMPLE.COM/ニュース ", "https://example.com/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9"],
    ["https://example.com/space here", "https://example.com/space%20here"]
  ]) assert.equal(safeExternalUrl(input), expected);
});

test("dangerous schemes, credentials, control characters and relative URLs are rejected", () => {
  for (const input of [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "blob:https://example.com/id",
    "vbscript:msgbox(1)", "ftp://example.com/file", "mailto:user@example.com",
    "//example.com/path", "/relative", "#anchor", "https://", "https://user:secret@example.com/",
    "https://example.com\\@attacker.example/", "https://example.com/a\nb", "https://example.com/\u0000",
    undefined, null, 1, {}, ["https://example.com/"]
  ]) assert.equal(safeExternalUrl(input), "", String(input));
});

test("Markdown destinations cannot break out through parentheses", () => {
  assert.equal(safeMarkdownUrl("https://example.com/a(b)"), "https://example.com/a%28b%29");
  assert.equal(safeMarkdownUrl("javascript:alert(1)"), "");
});

test("rendered news and map navigation use the shared URL guard", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const opened = [];
  const context = vm.createContext({
    safeExternalUrl, safeMarkdownUrl,
    regionMeta: { world: { labelJa: "世界" } }, topicLabel: value => value, formatRelative: () => "",
    window: { open: (...args) => opened.push(args) }
  });
  vm.runInContext(source.slice(source.indexOf("function safeExternalHref(")), context);
  const begin = source.indexOf("function articleTemplate(");
  vm.runInContext(source.slice(begin, source.indexOf("\nfunction filteredArticles(", begin)), context);
  const unsafe = vm.runInContext('articleTemplate({titleJa:"Test",topics:[],url:"javascript:alert(1)"})', context);
  assert.ok(unsafe.includes('href="#"'));
  assert.ok(!unsafe.includes("javascript:"));
  const valid = vm.runInContext('articleTemplate({titleJa:"<img src=x onerror=alert(1)>",topics:[],url:"https://example.com/?a=1&b=2"})', context);
  assert.ok(valid.includes('href="https://example.com/?a=1&amp;b=2"'));
  assert.ok(valid.includes("&lt;img") && !valid.includes("<img"));
  vm.runInContext('openExternalUrl("javascript:alert(1)"); openExternalUrl("https://example.com/news")', context);
  assert.deepEqual(opened, [["https://example.com/news", "_blank", "noopener,noreferrer"]]);
  assert.equal((source.match(/window\.open\(/g) || []).length, 1);
  assert.ok(!/escapeAttr\([^()\n]*\.url/.test(source));
});
