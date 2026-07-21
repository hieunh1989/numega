"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api";

type Tab = "ingredients" | "categories" | "users";
type Category = { id: string; slug: string; name: string; description: string; sort_order: number; status: "Active" | "Inactive"; ingredient_count: number };
type User = { id: string; full_name: string; email: string; role: "Admin" | "User"; status: "Active" | "Inactive"; created_at: string };
type Ingredient = Record<string, string | number | null>;
type Stats = { users: number; ingredients: number; categories: number };

const nutrientGroups = [
  { title: "Chỉ số nền", fields: ["ABC3 (mEq/kg)", "ABC4 (mEq/kg)", "Dry Matter (%)", "Moisture (%)"] },
  { title: "Dinh dưỡng đa lượng", fields: ["Crude Protein (%)", "Crude Fat (%)", "Crude Fiber (%)", "Ash (%)"] },
  { title: "Khoáng chất", fields: ["Calcium (%)", "Total Phosphorus (%)", "Available Phosphorus (%)", "Sodium (%)", "Potassium (%)", "Chloride (%)", "Magnesium (%)"] },
  { title: "Năng lượng", fields: ["ME Poultry (kcal/kg)", "ME Swine (kcal/kg)", "DE (kcal/kg)"] },
  { title: "Amino acids", fields: ["Lysine (%)", "Methionine (%)", "Methionine+Cysteine (%)", "Threonine (%)", "Tryptophan (%)", "Valine (%)"] },
];

const emptyUser = { full_name: "", email: "", password: "", role: "User", status: "Active" };
const emptyCategory = { name: "", description: "", sort_order: 10, status: "Active" };

function emptyIngredient(categoryId = "") {
  const value: Ingredient = {
    "Ingredient ID": "", "Ingredient Name": "", "Scientific Name": "", "Category ID": categoryId,
    Origin: "Local", Status: "Active", Notes: "",
  };
  nutrientGroups.flatMap((group) => group.fields).forEach((field) => { value[field] = 0; });
  return value;
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("ingredients");
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stats, setStats] = useState<Stats>({ users: 0, ingredients: 0, categories: 0 });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [userDraft, setUserDraft] = useState<Record<string, string> | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<Record<string, string | number> | null>(null);
  const [ingredientDraft, setIngredientDraft] = useState<Ingredient | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryData, userData, ingredientData, statsData] = await Promise.all([
        apiRequest<Category[]>("/api/categories"), apiRequest<User[]>("/api/users"),
        apiRequest<Ingredient[]>("/api/ingredients"), apiRequest<Stats>("/api/admin/stats"),
      ]);
      setCategories(categoryData);
      setUsers(userData);
      setIngredients(ingredientData);
      setStats(statsData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    apiRequest<User>("/api/auth/me")
      .then((user) => {
        if (user.role !== "Admin") window.location.replace("/");
        else loadAll();
      })
      .catch(() => window.location.replace("/login?returnTo=%2Fadmin"));
  }, [loadAll]);

  const filteredIngredients = useMemo(() => ingredients.filter((ingredient) => {
    const term = search.toLowerCase();
    const matchesSearch = !term || String(ingredient["Ingredient Name"]).toLowerCase().includes(term) || String(ingredient["Ingredient ID"]).toLowerCase().includes(term);
    return matchesSearch && (!categoryFilter || ingredient["Category ID"] === categoryFilter);
  }), [ingredients, search, categoryFilter]);

  const filteredUsers = useMemo(() => users.filter((user) => !search || `${user.full_name} ${user.email}`.toLowerCase().includes(search.toLowerCase())), [users, search]);

  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const request = async (action: () => Promise<unknown>, success: string) => {
    setError("");
    try { await action(); await loadAll(); flash(success); return true; }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể lưu dữ liệu."); return false; }
  };

  const openCreate = () => {
    setEditingId(null);
    if (tab === "users") setUserDraft({ ...emptyUser });
    if (tab === "categories") setCategoryDraft({ ...emptyCategory });
    if (tab === "ingredients") setIngredientDraft(emptyIngredient(categories[0]?.id));
  };

  const closeModal = () => { setUserDraft(null); setCategoryDraft(null); setIngredientDraft(null); setEditingId(null); };

  const editUser = (user: User) => { setEditingId(user.id); setUserDraft({ full_name: user.full_name, email: user.email, password: "", role: user.role, status: user.status }); };
  const editCategory = (category: Category) => { setEditingId(category.id); setCategoryDraft({ name: category.name, description: category.description, sort_order: category.sort_order, status: category.status }); };
  const editIngredient = (ingredient: Ingredient) => { setEditingId(String(ingredient["Ingredient ID"])); setIngredientDraft({ ...ingredient }); };

  const saveUser = async () => {
    if (!userDraft) return;
    const ok = await request(() => apiRequest(editingId ? `/api/users/${editingId}` : "/api/users", { method: editingId ? "PUT" : "POST", body: JSON.stringify(userDraft) }), editingId ? "Đã cập nhật user." : "Đã tạo user.");
    if (ok) closeModal();
  };
  const saveCategory = async () => {
    if (!categoryDraft) return;
    const ok = await request(() => apiRequest(editingId ? `/api/categories/${editingId}` : "/api/categories", { method: editingId ? "PUT" : "POST", body: JSON.stringify(categoryDraft) }), editingId ? "Đã cập nhật danh mục." : "Đã tạo danh mục.");
    if (ok) closeModal();
  };
  const saveIngredient = async () => {
    if (!ingredientDraft) return;
    const ok = await request(() => apiRequest(editingId ? `/api/ingredients/${editingId}` : "/api/ingredients", { method: editingId ? "PUT" : "POST", body: JSON.stringify(ingredientDraft) }), editingId ? "Đã cập nhật nguyên liệu." : "Đã tạo nguyên liệu.");
    if (ok) closeModal();
  };

  const remove = async (kind: Tab, id: string, label: string) => {
    if (!window.confirm(`Xóa “${label}”? Thao tác này không thể hoàn tác.`)) return;
    const path = kind === "users" ? "users" : kind === "categories" ? "categories" : "ingredients";
    await request(() => apiRequest(`/api/${path}/${id}`, { method: "DELETE" }), "Đã xóa dữ liệu.");
  };

  const logout = async () => {
    await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/login");
  };

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/"><span>N</span><div><strong>Numega</strong><small>Admin Console</small></div></Link>
        <nav>{navItems.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => { setTab(item.id); setSearch(""); }}><span>{item.icon}</span>{item.label}<b>{stats[item.stat]}</b></button>)}</nav>
        <div className="admin-sidebar-footer"><Link className="back-calculator" href="/">← Về Calculator</Link><button onClick={logout}>Đăng xuất</button></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar"><div><p>Numega Administration</p><h1>{navItems.find((item) => item.id === tab)?.title}</h1></div><div className="admin-top-actions"><button className="admin-logout" onClick={logout} aria-label="Đăng xuất" title="Đăng xuất">↪</button><button className="admin-primary" onClick={openCreate}>＋ Tạo mới</button></div></header>

        <div className="admin-stats">
          <Stat label="Nguyên liệu" value={stats.ingredients} tone="green" />
          <Stat label="Danh mục" value={stats.categories} tone="amber" />
          <Stat label="Người dùng" value={stats.users} tone="slate" />
        </div>

        {error && <div className="admin-alert error"><span>!</span>{error}<button onClick={() => setError("")}>×</button></div>}
        {notice && <div className="admin-alert success"><span>✓</span>{notice}</div>}

        <section className="admin-panel">
          <div className="admin-toolbar">
            <label className="admin-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "users" ? "Tìm tên hoặc email..." : "Tìm mã hoặc tên..."} /></label>
            {tab === "ingredients" && <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Tất cả danh mục</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>}
          </div>

          {loading ? <div className="admin-empty">Đang tải dữ liệu PostgreSQL…</div> : (
            <>
              {tab === "ingredients" && <IngredientList ingredients={filteredIngredients} onEdit={editIngredient} onDelete={(ingredient) => remove("ingredients", String(ingredient["Ingredient ID"]), String(ingredient["Ingredient Name"]))} />}
              {tab === "categories" && <CategoryList categories={categories} onEdit={editCategory} onDelete={(category) => remove("categories", category.id, category.name)} />}
              {tab === "users" && <UserList users={filteredUsers} onEdit={editUser} onDelete={(user) => remove("users", user.id, user.full_name)} />}
            </>
          )}
        </section>
      </section>

      <nav className="admin-mobile-nav">{navItems.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{item.short}</small></button>)}</nav>

      {userDraft && <AdminModal title={editingId ? "Chỉnh sửa user" : "Tạo user"} onClose={closeModal} onSave={saveUser}><div className="admin-form-grid"><Field label="Họ và tên"><input value={userDraft.full_name} onChange={(event) => setUserDraft({ ...userDraft, full_name: event.target.value })} /></Field><Field label="Email"><input type="email" value={userDraft.email} onChange={(event) => setUserDraft({ ...userDraft, email: event.target.value })} /></Field><Field label={editingId ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu"} wide><input type="password" autoComplete="new-password" minLength={8} value={userDraft.password} onChange={(event) => setUserDraft({ ...userDraft, password: event.target.value })} placeholder="Tối thiểu 8 ký tự" /></Field><Field label="Vai trò"><select value={userDraft.role} onChange={(event) => setUserDraft({ ...userDraft, role: event.target.value })}><option>Admin</option><option>User</option></select></Field><Field label="Trạng thái"><StatusSelect value={userDraft.status} onChange={(value) => setUserDraft({ ...userDraft, status: value })} /></Field></div></AdminModal>}

      {categoryDraft && <AdminModal title={editingId ? "Chỉnh sửa danh mục" : "Tạo danh mục"} onClose={closeModal} onSave={saveCategory}><div className="admin-form-grid"><Field label="Tên danh mục"><input value={String(categoryDraft.name)} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value })} /></Field><Field label="Thứ tự"><input type="number" value={Number(categoryDraft.sort_order)} onChange={(event) => setCategoryDraft({ ...categoryDraft, sort_order: Number(event.target.value) })} /></Field><Field label="Mô tả" wide><textarea value={String(categoryDraft.description)} onChange={(event) => setCategoryDraft({ ...categoryDraft, description: event.target.value })} /></Field><Field label="Trạng thái"><StatusSelect value={String(categoryDraft.status)} onChange={(value) => setCategoryDraft({ ...categoryDraft, status: value })} /></Field></div></AdminModal>}

      {ingredientDraft && <AdminModal title={editingId ? "Chỉnh sửa nguyên liệu" : "Tạo nguyên liệu"} onClose={closeModal} onSave={saveIngredient} large><div className="ingredient-form"><h3>Thông tin cơ bản</h3><div className="admin-form-grid"><Field label="Ingredient ID"><input disabled={Boolean(editingId)} value={String(ingredientDraft["Ingredient ID"] || "")} onChange={(event) => setIngredientDraft({ ...ingredientDraft, "Ingredient ID": event.target.value })} placeholder="ING-029" /></Field><Field label="Tên nguyên liệu"><input value={String(ingredientDraft["Ingredient Name"] || "")} onChange={(event) => setIngredientDraft({ ...ingredientDraft, "Ingredient Name": event.target.value })} /></Field><Field label="Tên khoa học"><input value={String(ingredientDraft["Scientific Name"] || "")} onChange={(event) => setIngredientDraft({ ...ingredientDraft, "Scientific Name": event.target.value })} /></Field><Field label="Danh mục"><select value={String(ingredientDraft["Category ID"] || "")} onChange={(event) => setIngredientDraft({ ...ingredientDraft, "Category ID": event.target.value })}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></Field><Field label="Nguồn gốc"><select value={String(ingredientDraft.Origin || "Local")} onChange={(event) => setIngredientDraft({ ...ingredientDraft, Origin: event.target.value })}><option>Local</option><option>Import</option></select></Field><Field label="Trạng thái"><StatusSelect value={String(ingredientDraft.Status)} onChange={(value) => setIngredientDraft({ ...ingredientDraft, Status: value })} /></Field><Field label="Ghi chú" wide><textarea value={String(ingredientDraft.Notes || "")} onChange={(event) => setIngredientDraft({ ...ingredientDraft, Notes: event.target.value })} /></Field></div>{nutrientGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div className="nutrient-form-grid">{group.fields.map((field) => { const numericValue = Number(ingredientDraft[field] || 0); return <Field label={field} key={field}><input type="number" step="any" value={numericValue === 0 ? "" : numericValue} placeholder="0" onChange={(event) => setIngredientDraft({ ...ingredientDraft, [field]: Number(event.target.value) })} /></Field>; })}</div></section>)}</div></AdminModal>}
    </main>
  );
}

const navItems: { id: Tab; label: string; short: string; title: string; icon: string; stat: keyof Stats }[] = [
  { id: "ingredients", label: "Nguyên liệu", short: "Nguyên liệu", title: "Quản lý nguyên liệu", icon: "▦", stat: "ingredients" },
  { id: "categories", label: "Danh mục", short: "Danh mục", title: "Danh mục nguyên liệu", icon: "◇", stat: "categories" },
  { id: "users", label: "Người dùng", short: "Users", title: "Quản lý người dùng", icon: "◎", stat: "users" },
];

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) { return <article className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong></article>; }
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={wide ? "field-wide" : ""}><span>{label}</span>{children}</label>; }
function StatusSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <select value={value} onChange={(event) => onChange(event.target.value)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select>; }

function AdminModal({ title, children, onClose, onSave, large }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void; large?: boolean }) {
  return <div className="admin-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`admin-modal ${large ? "large" : ""}`} role="dialog" aria-modal="true"><header><div><small>NUMEGA ADMIN</small><h2>{title}</h2></div><button onClick={onClose}>×</button></header><div className="admin-modal-body">{children}</div><footer><button onClick={onClose}>Hủy</button><button onClick={onSave}>Lưu thay đổi</button></footer></section></div>;
}

function IngredientList({ ingredients, onEdit, onDelete }: { ingredients: Ingredient[]; onEdit: (item: Ingredient) => void; onDelete: (item: Ingredient) => void }) {
  if (!ingredients.length) return <div className="admin-empty">Không tìm thấy nguyên liệu.</div>;
  return <div className="admin-list">{ingredients.map((item) => <article className="admin-row ingredient-admin-row" key={String(item["Ingredient ID"])}><div className="row-code">{item["Ingredient ID"]}</div><div className="row-main"><strong>{item["Ingredient Name"]}</strong><small><i>{item["Scientific Name"]}</i> · {item.Category}</small></div><div className="row-metrics"><span>Protein <b>{Number(item["Crude Protein (%)"]).toFixed(1)}%</b></span><span>ABC4 <b>{Number(item["ABC4 (mEq/kg)"]).toFixed(0)}</b></span></div><StatusPill value={String(item.Status)} /><RowActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} /></article>)}</div>;
}
function CategoryList({ categories, onEdit, onDelete }: { categories: Category[]; onEdit: (item: Category) => void; onDelete: (item: Category) => void }) {
  return <div className="admin-list">{categories.map((item) => <article className="admin-row" key={item.id}><div className="category-order">{item.sort_order}</div><div className="row-main"><strong>{item.name}</strong><small>{item.description || "Chưa có mô tả"}</small></div><span className="count-chip">{item.ingredient_count} nguyên liệu</span><StatusPill value={item.status} /><RowActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} /></article>)}</div>;
}
function UserList({ users, onEdit, onDelete }: { users: User[]; onEdit: (item: User) => void; onDelete: (item: User) => void }) {
  if (!users.length) return <div className="admin-empty">Không tìm thấy user.</div>;
  return <div className="admin-list">{users.map((item) => <article className="admin-row" key={item.id}><div className="user-avatar">{item.full_name.split(" ").slice(-2).map((word) => word[0]).join("").toUpperCase()}</div><div className="row-main"><strong>{item.full_name}</strong><small>{item.email}</small></div><span className="role-chip">{item.role}</span><StatusPill value={item.status} /><RowActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} /></article>)}</div>;
}
function StatusPill({ value }: { value: string }) { return <span className={`status-pill ${value.toLowerCase()}`}>{value}</span>; }
function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <div className="row-actions"><button onClick={onEdit} aria-label="Chỉnh sửa">✎</button><button className="danger" onClick={onDelete} aria-label="Xóa">×</button></div>; }
