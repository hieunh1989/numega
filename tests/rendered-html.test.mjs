import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("uses standard Next.js scripts without Vinext or Cloudflare", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.equal(packageJson.scripts.dev, "next dev -H 0.0.0.0");
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "next start -H 0.0.0.0");
  assert.equal(packageJson.dependencies.vinext, undefined);
  assert.equal(packageJson.devDependencies?.wrangler, undefined);
  assert.equal(packageJson.devDependencies?.["@cloudflare/vite-plugin"], undefined);
});

test("keeps browser API calls on the same Next.js origin", async () => {
  const client = await read("app/lib/api.ts");
  assert.match(client, /fetch\(path,/);
  assert.doesNotMatch(client, /localhost:4000|NEXT_PUBLIC_API_URL/);
});

test("keeps login and admin authorization in server-side route handlers", async () => {
  const [login, auth, security, database] = await Promise.all([
    read("app/api/auth/login/route.ts"),
    read("lib/server/api.ts"),
    read("lib/server/security.ts"),
    read("lib/server/database.ts"),
  ]);
  assert.match(login, /httpOnly:\s*true/);
  assert.match(login, /sameSite:\s*"lax"/);
  assert.match(auth, /requireAdmin/);
  assert.match(security, /scrypt/);
  assert.match(security, /timingSafeEqual/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS sessions/);
});

test("ships all PostgreSQL-backed Next.js API routes", async () => {
  const routes = [
    "app/api/health/route.ts",
    "app/api/admin/stats/route.ts",
    "app/api/categories/route.ts",
    "app/api/categories/[id]/route.ts",
    "app/api/users/route.ts",
    "app/api/users/[id]/route.ts",
    "app/api/ingredients/route.ts",
    "app/api/ingredients/[id]/route.ts",
  ];
  await Promise.all(routes.map(async (route) => assert.ok((await read(route)).length > 0, route)));
});
