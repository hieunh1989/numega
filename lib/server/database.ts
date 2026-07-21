import { randomUUID } from "node:crypto";
import { Pool, type QueryResultRow } from "pg";
import rawIngredients from "@/app/data/ingredients.json";
import { hashPassword } from "./security";

const DEFAULT_DATABASE_URL = "postgresql://numega:numega_local@localhost:5433/numega";

type NumegaGlobal = typeof globalThis & {
  numegaPool?: Pool;
  numegaDatabaseReady?: Promise<void>;
};

const globalForDatabase = globalThis as NumegaGlobal;

export const pool = globalForDatabase.numegaPool ?? new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX || (process.env.NODE_ENV === "production" ? 3 : 10)),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

if (process.env.NODE_ENV !== "production") globalForDatabase.numegaPool = pool;

export const ingredientDatabaseColumns = [
  "abc3", "abc4", "dry_matter", "moisture", "crude_protein", "crude_fat", "crude_fiber", "ash",
  "calcium", "total_phosphorus", "available_phosphorus", "sodium", "potassium", "chloride", "magnesium",
  "me_poultry", "me_swine", "de", "lysine", "methionine", "methionine_cysteine", "threonine", "tryptophan", "valine",
] as const;

const categorySeeds = [
  ["cereals", "Cereals", "Ngũ cốc và nguồn tinh bột", 1],
  ["protein-sources", "Protein Sources", "Nguồn cung cấp protein", 2],
  ["energy-oils-fats", "Energy (Oils & Fats)", "Dầu, mỡ và nguồn năng lượng", 3],
  ["minerals", "Minerals", "Khoáng đa lượng và vi lượng", 4],
  ["amino-acids", "Amino Acids", "Axit amin bổ sung", 5],
  ["others", "Others", "Premix, enzyme và nguyên liệu khác", 6],
] as const;

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'User' CHECK (role IN ('Admin', 'User')),
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
      password_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id)");
  await pool.query("DELETE FROM sessions WHERE expires_at <= NOW()");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      scientific_name TEXT NOT NULL DEFAULT '',
      category_id TEXT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      origin TEXT NOT NULL DEFAULT 'Local',
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
      notes TEXT NOT NULL DEFAULT '',
      abc3 DOUBLE PRECISION NOT NULL DEFAULT 0,
      abc4 DOUBLE PRECISION NOT NULL DEFAULT 0,
      dry_matter DOUBLE PRECISION NOT NULL DEFAULT 0,
      moisture DOUBLE PRECISION NOT NULL DEFAULT 0,
      crude_protein DOUBLE PRECISION NOT NULL DEFAULT 0,
      crude_fat DOUBLE PRECISION NOT NULL DEFAULT 0,
      crude_fiber DOUBLE PRECISION NOT NULL DEFAULT 0,
      ash DOUBLE PRECISION NOT NULL DEFAULT 0,
      calcium DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_phosphorus DOUBLE PRECISION NOT NULL DEFAULT 0,
      available_phosphorus DOUBLE PRECISION NOT NULL DEFAULT 0,
      sodium DOUBLE PRECISION NOT NULL DEFAULT 0,
      potassium DOUBLE PRECISION NOT NULL DEFAULT 0,
      chloride DOUBLE PRECISION NOT NULL DEFAULT 0,
      magnesium DOUBLE PRECISION NOT NULL DEFAULT 0,
      me_poultry DOUBLE PRECISION NOT NULL DEFAULT 0,
      me_swine DOUBLE PRECISION NOT NULL DEFAULT 0,
      de DOUBLE PRECISION NOT NULL DEFAULT 0,
      lysine DOUBLE PRECISION NOT NULL DEFAULT 0,
      methionine DOUBLE PRECISION NOT NULL DEFAULT 0,
      methionine_cysteine DOUBLE PRECISION NOT NULL DEFAULT 0,
      threonine DOUBLE PRECISION NOT NULL DEFAULT 0,
      tryptophan DOUBLE PRECISION NOT NULL DEFAULT 0,
      valine DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS ingredients_category_idx ON ingredients(category_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS ingredients_status_idx ON ingredients(status)");

  for (const [slug, name, description, sortOrder] of categorySeeds) {
    await pool.query(
      `INSERT INTO categories (id, slug, name, description, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, name=EXCLUDED.name,
       description=EXCLUDED.description, sort_order=EXCLUDED.sort_order`,
      [slug, slug, name, description, sortOrder],
    );
  }

  const ingredientCount = Number((await pool.query("SELECT COUNT(*) AS count FROM ingredients")).rows[0].count);
  if (ingredientCount === 0) await seedIngredients();

  const defaultAdminEmail = process.env.SEED_ADMIN_EMAIL || (process.env.NODE_ENV !== "production" ? "admin@numega.local" : "");
  const defaultAdminPassword = process.env.SEED_ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "Numega@123" : "");
  if (defaultAdminEmail && defaultAdminPassword) {
    const passwordHash = await hashPassword(defaultAdminPassword);
    await pool.query(
      `INSERT INTO users (id, full_name, email, role, status, password_hash)
       VALUES ($1, $2, $3, 'Admin', 'Active', $4)
       ON CONFLICT (email) DO UPDATE SET password_hash=COALESCE(users.password_hash, EXCLUDED.password_hash)`,
      [randomUUID(), "Numega Admin", defaultAdminEmail.toLowerCase(), passwordHash],
    );
  }
}

async function seedIngredients() {
  const source = rawIngredients as Record<string, unknown>[];
  const categoryRows = (await pool.query("SELECT id, name FROM categories")).rows as { id: string; name: string }[];
  const categoryByName = new Map(categoryRows.map((row) => [row.name, row.id]));
  const sql = `INSERT INTO ingredients (
    id, name, scientific_name, category_id, origin, status, notes, ${ingredientDatabaseColumns.join(", ")}
  ) VALUES (${Array.from({ length: 31 }, (_, index) => `$${index + 1}`).join(", ")}) ON CONFLICT (id) DO NOTHING`;

  for (const item of source) {
    const values = [
      item["Ingredient ID"], item["Ingredient Name"], item["Scientific Name"] || "", categoryByName.get(String(item.Category)),
      item.Origin || "Local", item.Status || "Active", item.Notes || "",
      item["ABC3 (mEq/kg)"], item["ABC4 (mEq/kg)"], item["Dry Matter (%)"], item["Moisture (%)"],
      item["Crude Protein (%)"], item["Crude Fat (%)"], item["Crude Fiber (%)"], item["Ash (%)"], item["Calcium (%)"],
      item["Total Phosphorus (%)"], item["Available Phosphorus (%)"], item["Sodium (%)"], item["Potassium (%)"],
      item["Chloride (%)"], item["Magnesium (%)"], item["ME Poultry (kcal/kg)"], item["ME Swine (kcal/kg)"],
      item["DE (kcal/kg)"], item["Lysine (%)"], item["Methionine (%)"], item["Methionine+Cysteine (%)"],
      item["Threonine (%)"], item["Tryptophan (%)"], item["Valine (%)"],
    ].map((value, index) => index >= 7 ? Number(value) || 0 : value);
    await pool.query(sql, values);
  }
}

export async function ensureDatabase() {
  if (!globalForDatabase.numegaDatabaseReady) {
    globalForDatabase.numegaDatabaseReady = initializeDatabase().catch((error) => {
      globalForDatabase.numegaDatabaseReady = undefined;
      throw error;
    });
  }
  await globalForDatabase.numegaDatabaseReady;
}

export function ingredientToExcelShape(row: QueryResultRow) {
  return {
    "Ingredient ID": row.id,
    "Ingredient Name": row.name,
    "Scientific Name": row.scientific_name,
    Category: row.category_name,
    "Category ID": row.category_id,
    Origin: row.origin,
    Status: row.status,
    Notes: row.notes,
    "ABC3 (mEq/kg)": row.abc3,
    "ABC4 (mEq/kg)": row.abc4,
    "Dry Matter (%)": row.dry_matter,
    "Moisture (%)": row.moisture,
    "Crude Protein (%)": row.crude_protein,
    "Crude Fat (%)": row.crude_fat,
    "Crude Fiber (%)": row.crude_fiber,
    "Ash (%)": row.ash,
    "Calcium (%)": row.calcium,
    "Total Phosphorus (%)": row.total_phosphorus,
    "Available Phosphorus (%)": row.available_phosphorus,
    "Sodium (%)": row.sodium,
    "Potassium (%)": row.potassium,
    "Chloride (%)": row.chloride,
    "Magnesium (%)": row.magnesium,
    "ME Poultry (kcal/kg)": row.me_poultry,
    "ME Swine (kcal/kg)": row.me_swine,
    "DE (kcal/kg)": row.de,
    "Lysine (%)": row.lysine,
    "Methionine (%)": row.methionine,
    "Methionine+Cysteine (%)": row.methionine_cysteine,
    "Threonine (%)": row.threonine,
    "Tryptophan (%)": row.tryptophan,
    "Valine (%)": row.valine,
  };
}
