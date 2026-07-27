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

test("ships an installable PWA and a dedicated phone install route", async () => {
  const [manifestText, installPage, serviceWorker] = await Promise.all([
    read("public/manifest.webmanifest"),
    read("app/install/page.tsx"),
    read("public/sw.js"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.type === "image/png"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  assert.match(installPage, /beforeinstallprompt/);
  assert.match(installPage, /installPrompt\.prompt\(\)/);
  assert.match(installPage, /Add to Home Screen/);
  assert.match(installPage, /CriOS/);
  assert.match(installPage, /Select “More”/);
  assert.match(serviceWorker, /\/install/);
});

test("keeps empty numeric drafts editable without forcing zero back into the input", async () => {
  const [calculator, admin] = await Promise.all([
    read("app/page.tsx"),
    read("app/admin/page.tsx"),
  ]);
  assert.match(calculator, /inclusionDrafts\[row\.id\] \?\? \(row\.inclusion === 0 \? "" : String\(row\.inclusion\)\)/);
  assert.match(calculator, /setInclusionDrafts\(\(current\) => \(\{ \.\.\.current, \[id\]: value \}\)\)/);
  assert.match(calculator, /onBlur=\{\(\) => finishInclusionEdit\(row\.id\)\}/);
  assert.match(admin, /\[field\]: event\.target\.value/);
  assert.match(admin, /fieldValue === 0 \|\| fieldValue == null \? "" : String\(fieldValue\)/);
});

test("keeps product copy in production-ready English", async () => {
  const installPage = await read("app/install/page.tsx");
  assert.doesNotMatch(installPage, /\b(?:anh|bạn|mình)\b/i);
  assert.match(installPage, /The app has been added to this device\. Open Numega/);
});

test("uses English across product UI, metadata, and API messages", async () => {
  const productFiles = await Promise.all([
    "app/page.tsx",
    "app/admin/page.tsx",
    "app/login/page.tsx",
    "app/install/page.tsx",
    "app/install/layout.tsx",
    "app/layout.tsx",
    "app/lib/api.ts",
    "lib/server/api.ts",
  ].map(read));
  const productCopy = productFiles.join("\n");
  assert.doesNotMatch(productCopy, /[ăâđêôơưĂÂĐÊÔƠƯáàảãạéèẻẽẹíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠÉÈẺẼẸÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/);
  assert.doesNotMatch(productCopy, /vi-VN|lang="vi"/);
  assert.match(productCopy, /Formula Results/);
  assert.match(productCopy, /Ingredient Management/);
  assert.match(productCopy, /Sign In/);

  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  assert.equal(manifest.lang, "en");
  assert.match(manifest.description, /Calculate animal feed formulas/);
});
