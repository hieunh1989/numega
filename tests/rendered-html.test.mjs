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

test("serves PWA images directly and keeps offline image fallbacks", async () => {
  const [nextConfig, serviceWorker] = await Promise.all([
    read("next.config.ts"),
    read("public/sw.js"),
  ]);
  assert.match(nextConfig, /images:\s*\{\s*unoptimized:\s*true\s*\}/);
  assert.match(serviceWorker, /const CACHE = "numega-v10"/);
  assert.match(serviceWorker, /url\.pathname === "\/_next\/image"/);
  assert.match(serviceWorker, /caches\.match\(originalPath\)/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
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

test("sends administrators to the admin interface after sign in", async () => {
  const loginPage = await read("app/login/page.tsx");
  assert.match(loginPage, /user\.role === "Admin" && requested === "\/"/);
  assert.match(loginPage, /return "\/admin"/);
  assert.match(loginPage, /\.then\(\(user\) => \{ window\.location\.replace\(destinationFor\(user\)\); \}\)/);
  assert.match(loginPage, /window\.location\.replace\(destinationFor\(user\)\)/);
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
  assert.doesNotMatch(installPage, /install-app-icon|\/icons\/pwa\/icon-192\.png/);
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

test("loads calculator categories from PostgreSQL and honors the admin visibility switch", async () => {
  const [calculator, admin, categoriesApi, categoryApi, database] = await Promise.all([
    read("app/page.tsx"),
    read("app/admin/page.tsx"),
    read("app/api/categories/route.ts"),
    read("app/api/categories/[id]/route.ts"),
    read("lib/server/database.ts"),
  ]);
  assert.match(database, /show_in_calculator BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(database, /icon TEXT NOT NULL DEFAULT '\/icons\/categories\/others\.png'/);
  assert.match(database, /INSERT INTO categories[\s\S]+ON CONFLICT \(id\) DO NOTHING/);
  assert.doesNotMatch(database, /ON CONFLICT \(id\) DO UPDATE SET slug=EXCLUDED\.slug, name=EXCLUDED\.name/);
  assert.match(categoriesApi, /calculatorOnly/);
  assert.match(categoriesApi, /c\.show_in_calculator=TRUE/);
  assert.match(categoryApi, /show_in_calculator=\$5/);
  assert.match(admin, /Show in calculator/);
  assert.match(admin, /type="checkbox"/);
  assert.doesNotMatch(admin, /Built-in Icon|categoryIconOptions/);
  assert.match(admin, /Upload Icon/);
  assert.match(admin, /readAsDataURL/);
  assert.match(admin, /500 KB or smaller/);
  assert.match(calculator, /\/api\/categories\?calculator=true/);
  assert.match(calculator, /category\.icon \|\| "\/icons\/categories\/others\.png"/);
  assert.match(calculator, /categories\.map\(\(category, index\)/);
  assert.doesNotMatch(calculator, /CATEGORY_ORDER\.map/);
});

test("shows admin save results as self-dismissing toast notifications", async () => {
  const admin = await read("app/admin/page.tsx");
  assert.match(admin, /className="toast admin-toast"/);
  assert.match(admin, /role="status"/);
  assert.match(admin, /aria-live="polite"/);
  assert.match(admin, /window\.setTimeout/);
  assert.doesNotMatch(admin, /admin-alert success/);
});

test("allows formula calculation at any total inclusion", async () => {
  const calculator = await read("app/page.tsx");
  assert.match(calculator, /You can still calculate with the current total inclusion/);
  assert.match(calculator, /Total inclusion: \{totalInclusion\.toLocaleString/);
  assert.doesNotMatch(calculator, /disabled=\{!isValid\}/);
  assert.doesNotMatch(calculator, /must equal exactly 100% before calculation/);
});

test("shows ABC3 and ABC4 in the category contribution table", async () => {
  const calculator = await read("app/page.tsx");
  assert.match(calculator, /ABC3 & ABC4 Contribution by Category/);
  assert.match(calculator, /<span>ABC3<\/span><span>ABC4<\/span><span>%<\/span>/);
  assert.match(calculator, /item\.abc3\.toFixed\(1\)/);
  assert.doesNotMatch(calculator, /% Contribution<\/span>/);
});

test("renders ABC3 and ABC4 status gauges with their risk thresholds", async () => {
  const [calculator, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(calculator, /function AbcStatusGauge/);
  assert.match(calculator, /function AbcRecommendation/);
  assert.match(calculator, /Feed ABC Current Status/);
  assert.match(calculator, /metric="ABC3"[^>]+excellentMin=\{500\}[^>]+excellentMax=\{600\}[^>]+acceptableMax=\{650\}[^>]+scaleMin=\{500\}[^>]+baseMax=\{700\}[^>]+expandScale=\{false\}/);
  assert.match(calculator, /metric="ABC4"[^>]+excellentMin=\{250\}[^>]+excellentMax=\{350\}[^>]+acceptableMax=\{450\}[^>]+scaleMin=\{250\}[^>]+showScaleMaximum=\{false\}/);
  assert.match(calculator, /<span style=\{\{ left: "0%" \}\}>\{scaleMin\}<\/span>/);
  assert.match(calculator, /\{showScaleMaximum && <span className="scale-maximum" style=\{\{ left: "100%" \}\}>\{scaleMax\}<\/span>\}/);
  assert.match(calculator, /Current status/);
  assert.match(calculator, /High Risk/);
  assert.doesNotMatch(calculator, /<small>Current value<\/small>/);
  assert.match(calculator, /Recommendations/);
  assert.match(calculator, /const optimizationMax = metric === "ABC3" \? 700 : acceptableMax/);
  assert.match(calculator, /\(value - optimizationMax\) \/ 12\.4/);
  assert.doesNotMatch(calculator, /\(value - excellentMax\) \/ 10/);
  assert.match(calculator, /ABC\) profile, Numega recommends/);
  assert.match(calculator, /Acidifier \(Paraformic Acid\)/);
  assert.match(calculator, /row\.ingredient\["Ingredient ID"\] === "ING-018"/);
  assert.match(calculator, /Ingredient Name"\]\.trim\(\)\.toLowerCase\(\) === "limestone"/);
  assert.match(calculator, /recommendation-limestone/);
  assert.match(calculator, /\{hasLimestone && <p className="recommendation-limestone"><strong>Reduce Calcium Carbonate CaCO3 inclusion\.<\/strong><\/p>\}/);
  assert.match(calculator, /<div className="recommendation-primary">/);
  assert.match(calculator, /<strong>Highly Recommended:<\/strong>\s*<span>Add <strong>Acidifier/);
  assert.doesNotMatch(calculator, /Optimization calculation|recommendation-checklist|aria-hidden="true">✓/);
  assert.match(styles, /\.abc-gauge-track/);
  assert.match(styles, /\.abc-gauge-marker/);
  assert.match(styles, /\.recommendation-dialog/);
  assert.match(styles, /\.recommendation-primary \{[^}]*border: 1px solid #e0ebe5;[^}]*background: #f3f8f5;/);
  assert.doesNotMatch(styles, /\.recommendation-checklist|\.recommendation-calculation/);
  assert.match(styles, /\.abc-gauge-header > div > span \{ color: var\(--primary\);/);
  assert.match(styles, /\.abc-gauge-grid \{ grid-template-columns: 1fr; \}/);
});

test("forecasts feed quality stars from ABC4 status only", async () => {
  const [calculator, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(calculator, /Feed Quality Forecast — Gastric Function/);
  assert.match(calculator, /function FeedQualityForecast\(\{ abc4 \}/);
  assert.match(calculator, /abcStatus\(abc4, 350, 450, "ABC4"\)/);
  assert.match(calculator, /className === "excellent" \? 5 : status\.className === "acceptable" \? 3 : 1/);
  assert.match(calculator, /Feed Acidification Efficiency/);
  assert.match(calculator, /Pepsin Activation Potential/);
  assert.match(calculator, /Protein Acid Denaturation Potential/);
  assert.match(calculator, /Gastric Pathogen Barrier \(Salmonella\)/);
  assert.doesNotMatch(calculator, /Salmonella control|Feed hygiene|Protein digestion|Buffering reduction/);
  assert.match(calculator, /\{rating\} out of 5 stars/);
  assert.match(styles, /\.feed-quality-row/);
  assert.match(styles, /\.quality-stars i\.filled/);
});

test("renders ABC4 categories as a negative-base waterfall chart", async () => {
  const calculator = await read("app/page.tsx");
  assert.match(calculator, /function CategoryWaterfallChart/);
  assert.match(calculator, /CategoryWaterfallChart items=\{categoryResults\} metric="ABC4" hasLimestone=\{hasLimestone\}/);
  assert.match(calculator, /CategoryWaterfallChart items=\{categoryResults\} metric="ABC3" hasLimestone=\{hasLimestone\}/);
  assert.match(calculator, /metric="ABC4"/);
  assert.match(calculator, /ABC3 Contribution by Category/);
  assert.match(calculator, /metric="ABC3"/);
  assert.match(calculator, /metric === "ABC3" \? item\.abc3 : item\.abc4/);
  assert.match(calculator, /const negativeTotal/);
  assert.match(calculator, /bottomAt\(negativeTotal \+ previous\)/);
  assert.match(calculator, /className="waterfall-stack waterfall-negative-stack"/);
  assert.match(calculator, /className="waterfall-stack waterfall-positive-stack"/);
  assert.match(calculator, /className="waterfall-body"/);
  assert.match(calculator, /className="waterfall-legend"/);
  assert.match(calculator, /className="waterfall-y-axis"/);
  assert.match(calculator, /<div className="waterfall-summary">/);
  assert.match(calculator, /<div className="waterfall-current-status"><span>Current status<\/span><strong className=\{status\.className\}>/);
  assert.match(calculator, /<AbcRecommendation metric=\{metric\} value=\{finalTotal\}/);
  assert.match(calculator, /function CategoryLegendRow/);
  assert.match(calculator, /Σ=\{finalTotal\.toFixed\(1\)\}/);
  assert.doesNotMatch(calculator, /Ingredient Category<\/strong>|Positive stack<\/span>|Zero<\/span>/);
  assert.doesNotMatch(calculator, /<b>\{item\.abc4\.toFixed\(1\)\}<\/b><\/i>/);
  assert.doesNotMatch(calculator, /className="category-column-chart"/);
  const styles = await read("app/globals.css");
  assert.match(styles, /\.waterfall-category-row \{[^}]*padding: 3px 0;/);
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
  assert.match(productCopy, /ABC Results Analysis/);
  assert.match(productCopy, /Ingredient Management/);
  assert.match(productCopy, /Sign In/);

  const manifest = JSON.parse(await read("public/manifest.webmanifest"));
  assert.equal(manifest.lang, "en");
  assert.match(manifest.description, /Calculate animal feed formulas/);
});
