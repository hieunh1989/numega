import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { categorySeeds, ingredientDatabaseColumns, ingredientToExcelShape, initializeDatabase, pool } from "./db.mjs";
import { createSessionToken, hashPassword, hashSessionToken, readCookie, verifyPassword } from "./security.mjs";

const app = express();
const port = Number(process.env.API_PORT || 4000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

const asyncRoute = (handler) => async (request, response, next) => {
  try { await handler(request, response, next); } catch (error) { next(error); }
};
const text = (value, fallback = "") => typeof value === "string" ? value.trim() : fallback;
const statusValue = (value) => value === "Inactive" ? "Inactive" : "Active";
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ingredientSelect = `SELECT i.*, c.name AS category_name FROM ingredients i JOIN categories c ON c.id = i.category_id`;
const sessionCookie = "numega_session";
const publicUserColumns = "id, full_name, email, role, status, created_at, updated_at";

async function authenticatedUser(request) {
  const token = readCookie(request, sessionCookie);
  if (!token) return null;
  const columns = publicUserColumns.split(", ").map((column) => `u.${column}`).join(", ");
  const result = await pool.query(
    `SELECT ${columns} FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.status='Active'`,
    [hashSessionToken(token)],
  );
  return result.rows[0] || null;
}

const requireAdmin = asyncRoute(async (request, response, next) => {
  const user = await authenticatedUser(request);
  if (!user) return response.status(401).json({ message: "Vui lòng đăng nhập để tiếp tục." });
  if (user.role !== "Admin") return response.status(403).json({ message: "Tài khoản không có quyền quản trị." });
  request.user = user;
  next();
});

app.post("/api/auth/login", asyncRoute(async (request, response) => {
  const email = text(request.body.email).toLowerCase();
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const result = await pool.query(`SELECT ${publicUserColumns}, password_hash FROM users WHERE email=$1`, [email]);
  const user = result.rows[0];
  if (!user || user.status !== "Active" || !(await verifyPassword(password, user.password_hash))) {
    return response.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
  }
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)", [hashSessionToken(token), user.id, expiresAt]);
  response.cookie(sessionCookie, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
  response.json(Object.fromEntries(publicUserColumns.split(", ").map((column) => [column, user[column]])));
}));

app.get("/api/auth/me", asyncRoute(async (request, response) => {
  const user = await authenticatedUser(request);
  if (!user) return response.status(401).json({ message: "Chưa đăng nhập." });
  response.json(user);
}));

app.post("/api/auth/logout", asyncRoute(async (request, response) => {
  const token = readCookie(request, sessionCookie);
  if (token) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [hashSessionToken(token)]);
  response.clearCookie(sessionCookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  response.status(204).end();
}));

app.use("/api/admin", requireAdmin);
app.use("/api/users", requireAdmin);
app.use("/api/categories", (request, response, next) => request.method === "GET" ? next() : requireAdmin(request, response, next));
app.use("/api/ingredients", (request, response, next) => request.method === "GET" ? next() : requireAdmin(request, response, next));

app.get("/api/health", asyncRoute(async (_request, response) => {
  await pool.query("SELECT 1");
  response.json({ ok: true, service: "numega-api", database: "postgresql" });
}));

app.get("/api/admin/stats", asyncRoute(async (_request, response) => {
  const [users, ingredients, categories] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM users"),
    pool.query("SELECT COUNT(*)::int AS count FROM ingredients"),
    pool.query("SELECT COUNT(*)::int AS count FROM categories"),
  ]);
  response.json({ users: users.rows[0].count, ingredients: ingredients.rows[0].count, categories: categories.rows[0].count });
}));

app.get("/api/categories", asyncRoute(async (_request, response) => {
  const result = await pool.query(`SELECT c.*, COUNT(i.id)::int AS ingredient_count FROM categories c LEFT JOIN ingredients i ON i.category_id = c.id GROUP BY c.id ORDER BY c.sort_order, c.name`);
  response.json(result.rows);
}));

app.post("/api/categories", asyncRoute(async (request, response) => {
  const name = text(request.body.name);
  if (!name) return response.status(400).json({ message: "Tên danh mục là bắt buộc." });
  const slug = text(request.body.slug, name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  const result = await pool.query(
    "INSERT INTO categories (id, slug, name, description, sort_order, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [slug, slug, name, text(request.body.description), number(request.body.sort_order), statusValue(request.body.status)],
  );
  response.status(201).json(result.rows[0]);
}));

app.put("/api/categories/:id", asyncRoute(async (request, response) => {
  const name = text(request.body.name);
  if (!name) return response.status(400).json({ message: "Tên danh mục là bắt buộc." });
  const result = await pool.query(
    "UPDATE categories SET name=$1, description=$2, sort_order=$3, status=$4, updated_at=NOW() WHERE id=$5 RETURNING *",
    [name, text(request.body.description), number(request.body.sort_order), statusValue(request.body.status), request.params.id],
  );
  if (!result.rowCount) return response.status(404).json({ message: "Không tìm thấy danh mục." });
  response.json(result.rows[0]);
}));

app.delete("/api/categories/:id", asyncRoute(async (request, response) => {
  const count = await pool.query("SELECT COUNT(*)::int AS count FROM ingredients WHERE category_id=$1", [request.params.id]);
  if (count.rows[0].count > 0) return response.status(409).json({ message: "Danh mục đang có nguyên liệu. Hãy chuyển nguyên liệu sang danh mục khác trước." });
  const result = await pool.query("DELETE FROM categories WHERE id=$1", [request.params.id]);
  if (!result.rowCount) return response.status(404).json({ message: "Không tìm thấy danh mục." });
  response.status(204).end();
}));

app.get("/api/users", asyncRoute(async (request, response) => {
  const query = text(request.query.q).toLowerCase();
  const result = await pool.query(
    `SELECT ${publicUserColumns} FROM users WHERE ($1 = '' OR LOWER(full_name) LIKE $2 OR LOWER(email) LIKE $2) ORDER BY created_at DESC`,
    [query, `%${query}%`],
  );
  response.json(result.rows);
}));

app.post("/api/users", asyncRoute(async (request, response) => {
  const fullName = text(request.body.full_name);
  const email = text(request.body.email).toLowerCase();
  const password = typeof request.body.password === "string" ? request.body.password : "";
  if (!fullName || !email.includes("@")) return response.status(400).json({ message: "Họ tên và email hợp lệ là bắt buộc." });
  const role = request.body.role === "Admin" ? "Admin" : "User";
  if (password.length < 8) return response.status(400).json({ message: "Mật khẩu phải có ít nhất 8 ký tự." });
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (id, full_name, email, role, status, password_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${publicUserColumns}`,
    [randomUUID(), fullName, email, role, statusValue(request.body.status), passwordHash],
  );
  response.status(201).json(result.rows[0]);
}));

app.put("/api/users/:id", asyncRoute(async (request, response) => {
  const fullName = text(request.body.full_name);
  const email = text(request.body.email).toLowerCase();
  const password = typeof request.body.password === "string" ? request.body.password : "";
  if (!fullName || !email.includes("@")) return response.status(400).json({ message: "Họ tên và email hợp lệ là bắt buộc." });
  if (password && password.length < 8) return response.status(400).json({ message: "Mật khẩu mới phải có ít nhất 8 ký tự." });
  const passwordHash = password ? await hashPassword(password) : null;
  const result = await pool.query(
    `UPDATE users SET full_name=$1,email=$2,role=$3,status=$4,password_hash=COALESCE($5,password_hash),updated_at=NOW() WHERE id=$6 RETURNING ${publicUserColumns}`,
    [fullName, email, request.body.role === "Admin" ? "Admin" : "User", statusValue(request.body.status), passwordHash, request.params.id],
  );
  if (!result.rowCount) return response.status(404).json({ message: "Không tìm thấy user." });
  response.json(result.rows[0]);
}));

app.delete("/api/users/:id", asyncRoute(async (request, response) => {
  const result = await pool.query("DELETE FROM users WHERE id=$1", [request.params.id]);
  if (!result.rowCount) return response.status(404).json({ message: "Không tìm thấy user." });
  response.status(204).end();
}));

app.get("/api/ingredients", asyncRoute(async (request, response) => {
  const query = text(request.query.q).toLowerCase();
  const category = text(request.query.category);
  const activeOnly = request.query.active === "true";
  const result = await pool.query(
    `${ingredientSelect} WHERE ($1 = '' OR LOWER(i.name) LIKE $2 OR LOWER(i.id) LIKE $2 OR LOWER(i.scientific_name) LIKE $2)
     AND ($3 = '' OR i.category_id = $3) AND ($4 = FALSE OR i.status = 'Active') ORDER BY c.sort_order, i.name`,
    [query, `%${query}%`, category, activeOnly],
  );
  response.json(result.rows.map(ingredientToExcelShape));
}));

function ingredientValues(body, id) {
  const excelKeys = [
    "ABC3 (mEq/kg)", "ABC4 (mEq/kg)", "Dry Matter (%)", "Moisture (%)", "Crude Protein (%)", "Crude Fat (%)",
    "Crude Fiber (%)", "Ash (%)", "Calcium (%)", "Total Phosphorus (%)", "Available Phosphorus (%)", "Sodium (%)",
    "Potassium (%)", "Chloride (%)", "Magnesium (%)", "ME Poultry (kcal/kg)", "ME Swine (kcal/kg)", "DE (kcal/kg)",
    "Lysine (%)", "Methionine (%)", "Methionine+Cysteine (%)", "Threonine (%)", "Tryptophan (%)", "Valine (%)",
  ];
  return [
    id, text(body["Ingredient Name"]), text(body["Scientific Name"]), text(body["Category ID"]), text(body.Origin, "Local"),
    statusValue(body.Status), text(body.Notes), ...excelKeys.map((key) => number(body[key])),
  ];
}

app.post("/api/ingredients", asyncRoute(async (request, response) => {
  const id = text(request.body["Ingredient ID"]).toUpperCase();
  if (!id || !text(request.body["Ingredient Name"]) || !text(request.body["Category ID"])) return response.status(400).json({ message: "Mã, tên và danh mục nguyên liệu là bắt buộc." });
  const values = ingredientValues(request.body, id);
  const columns = ["id", "name", "scientific_name", "category_id", "origin", "status", "notes", ...ingredientDatabaseColumns];
  await pool.query(`INSERT INTO ingredients (${columns.join(",")}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(",")})`, values);
  const result = await pool.query(`${ingredientSelect} WHERE i.id=$1`, [id]);
  response.status(201).json(ingredientToExcelShape(result.rows[0]));
}));

app.put("/api/ingredients/:id", asyncRoute(async (request, response) => {
  if (!text(request.body["Ingredient Name"]) || !text(request.body["Category ID"])) return response.status(400).json({ message: "Tên và danh mục nguyên liệu là bắt buộc." });
  const values = ingredientValues(request.body, request.params.id);
  const columns = ["id", "name", "scientific_name", "category_id", "origin", "status", "notes", ...ingredientDatabaseColumns];
  const assignments = columns.slice(1).map((column, index) => `${column}=$${index + 2}`).join(",");
  const result = await pool.query(`UPDATE ingredients SET ${assignments}, updated_at=NOW() WHERE id=$1 RETURNING id`, values);
  if (!result.rowCount) return response.status(404).json({ message: "Không tìm thấy nguyên liệu." });
  const updated = await pool.query(`${ingredientSelect} WHERE i.id=$1`, [request.params.id]);
  response.json(ingredientToExcelShape(updated.rows[0]));
}));

app.delete("/api/ingredients/:id", asyncRoute(async (request, response) => {
  const result = await pool.query("DELETE FROM ingredients WHERE id=$1", [request.params.id]);
  if (!result.rowCount) return response.status(404).json({ message: "Không tìm thấy nguyên liệu." });
  response.status(204).end();
}));

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error.code === "23505") return response.status(409).json({ message: "Dữ liệu đã tồn tại hoặc bị trùng." });
  if (error.code === "23503") return response.status(400).json({ message: "Danh mục được chọn không tồn tại." });
  response.status(500).json({ message: "Máy chủ gặp lỗi. Vui lòng thử lại." });
});

await initializeDatabase();
app.listen(port, "0.0.0.0", () => console.log(`Numega API ready at http://0.0.0.0:${port}`));
