import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Numega calculator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Numega · Feed Formula Calculator<\/title>/i);
  assert.match(html, /src="\/numega-logo\.png"/i);
  assert.match(html, /class="action-dock"/i);
  assert.match(html, /Sáu nhóm nguyên liệu/i);
});

test("server-renders the mobile login screen", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Đăng nhập/i);
  assert.match(html, /autocomplete="username"/i);
  assert.match(html, /autocomplete="current-password"/i);
  assert.match(html, /class="login-submit"/i);
});

test("keeps passwords and admin APIs protected on the server", async () => {
  const [server, database, security] = await Promise.all([
    readFile(new URL("../server/index.mjs", import.meta.url), "utf8"),
    readFile(new URL("../server/db.mjs", import.meta.url), "utf8"),
    readFile(new URL("../server/security.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(database, /password_hash TEXT/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS sessions/);
  assert.match(security, /scrypt/);
  assert.match(security, /timingSafeEqual/);
  assert.match(server, /httpOnly:\s*true/);
  assert.match(server, /app\.use\("\/api\/admin", requireAdmin\)/);
  assert.doesNotMatch(server, /SELECT \* FROM users WHERE/);
});
