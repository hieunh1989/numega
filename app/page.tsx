"use client";

import { type MouseEvent, useEffect, useMemo, useState } from "react";
import rawIngredients from "./data/ingredients.json";
import { apiRequest } from "./lib/api";

type Ingredient = (typeof rawIngredients)[number];
type FormulaItem = { id: string; inclusion: number };
type ResultTab = "overview" | "groups";
type AuthUser = { id: string; full_name: string; email: string; role: "Admin" | "User"; status: string };

const CATEGORY_ORDER = [
  "Cereals",
  "Protein Sources",
  "Energy (Oils & Fats)",
  "Minerals",
  "Amino Acids",
  "Others",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  Cereals: "Cereals",
  "Protein Sources": "Protein Sources",
  "Energy (Oils & Fats)": "Oils & Fats",
  Minerals: "Minerals",
  "Amino Acids": "Amino Acids",
  Others: "Others",
};

const NUTRIENTS = [
  ["ABC3 (mEq/kg)", "ABC3", "mEq/kg"],
  ["ABC4 (mEq/kg)", "ABC4", "mEq/kg"],
  ["Crude Protein (%)", "Protein", "%"],
  ["Crude Fat (%)", "Fat", "%"],
  ["Crude Fiber (%)", "Fiber", "%"],
  ["Ash (%)", "Ash", "%"],
  ["Calcium (%)", "Calcium", "%"],
  ["Total Phosphorus (%)", "Phosphorus", "%"],
  ["Sodium (%)", "Sodium", "%"],
  ["ME Poultry (kcal/kg)", "ME Poultry", "kcal/kg"],
  ["ME Swine (kcal/kg)", "ME Swine", "kcal/kg"],
] as const;

const INITIAL_FORMULA: FormulaItem[] = [
  { id: "ING-001", inclusion: 30 },
  { id: "ING-002", inclusion: 30 },
  { id: "ING-007", inclusion: 25 },
  { id: "ING-015", inclusion: 2 },
  { id: "ING-018", inclusion: 2 },
  { id: "ING-022", inclusion: 1 },
  { id: "ING-026", inclusion: 2 },
];

const icons: Record<string, string> = {
  Cereals: "/icons/categories/cereals.png",
  "Protein Sources": "/icons/categories/protein-sources.png",
  "Energy (Oils & Fats)": "/icons/categories/oils-fats.png",
  Minerals: "/icons/categories/minerals.png",
  "Amino Acids": "/icons/categories/amino-acids.png",
  Others: "/icons/categories/others.png",
};

function numberValue(ingredient: Ingredient, key: string) {
  const value = ingredient[key as keyof Ingredient];
  return typeof value === "number" ? value : Number(value) || 0;
}

function formatValue(value: number, unit: string) {
  if (unit === "kcal/kg" || unit === "mEq/kg") return Math.round(value).toLocaleString("vi-VN");
  return value.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MiniIcon({ children }: { children: React.ReactNode }) {
  return <span className="mini-icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>(rawIngredients);
  const [dataSource, setDataSource] = useState<"database" | "offline">("offline");
  const [formula, setFormula] = useState<FormulaItem[]>(INITIAL_FORMULA);
  const [expanded, setExpanded] = useState<string>("Cereals");
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>("overview");
  const [saved, setSaved] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("agricalc-formula");
    if (stored) {
      try { setFormula(JSON.parse(stored)); } catch { /* keep safe defaults */ }
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const cachedIngredients = localStorage.getItem("numega-ingredients");
    if (cachedIngredients) {
      try { setIngredients(JSON.parse(cachedIngredients)); } catch { /* use embedded database */ }
    }
    apiRequest<Ingredient[]>("/api/ingredients?active=true")
      .then((databaseIngredients) => {
        setIngredients(databaseIngredients);
        setDataSource("database");
        localStorage.setItem("numega-ingredients", JSON.stringify(databaseIngredients));
      })
      .catch(() => setDataSource("offline"));
    apiRequest<AuthUser>("/api/auth/me").then(setAuthUser).catch(() => setAuthUser(null));
    const syncStatus = () => setOnline(navigator.onLine);
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    syncStatus();
    window.addEventListener("online", syncStatus);
    window.addEventListener("offline", syncStatus);
    window.addEventListener("beforeinstallprompt", captureInstall);
    return () => {
      window.removeEventListener("online", syncStatus);
      window.removeEventListener("offline", syncStatus);
      window.removeEventListener("beforeinstallprompt", captureInstall);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("agricalc-formula", JSON.stringify(formula));
  }, [formula]);

  const ingredientMap = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient["Ingredient ID"], ingredient])),
    [ingredients],
  );

  const rows = useMemo(
    () => formula.map((item) => ({ ...item, ingredient: ingredientMap.get(item.id)! })).filter((row) => row.ingredient),
    [formula, ingredientMap],
  );

  const totalInclusion = useMemo(() => formula.reduce((sum, item) => sum + item.inclusion, 0), [formula]);
  const isValid = Math.abs(totalInclusion - 100) < 0.0001;

  const totals = useMemo(() => {
    return Object.fromEntries(NUTRIENTS.map(([key]) => [key, rows.reduce((sum, row) => sum + numberValue(row.ingredient, key) * row.inclusion / 100, 0)]));
  }, [rows]);

  const categoryResults = useMemo(() => CATEGORY_ORDER.map((category) => {
    const categoryRows = rows.filter((row) => row.ingredient.Category === category);
    return {
      category,
      inclusion: categoryRows.reduce((sum, row) => sum + row.inclusion, 0),
      abc4: categoryRows.reduce((sum, row) => sum + numberValue(row.ingredient, "ABC4 (mEq/kg)") * row.inclusion / 100, 0),
    };
  }), [rows]);

  const updateInclusion = (id: string, value: string) => {
    const parsed = Math.max(0, Math.min(100, Number(value) || 0));
    setFormula((current) => current.map((item) => item.id === id ? { ...item, inclusion: parsed } : item));
  };

  const toggleCategory = (category: string, event: MouseEvent<HTMLButtonElement>) => {
    const opening = expanded !== category;
    const card = event.currentTarget.closest(".category-card");
    setExpanded(opening ? category : "");
    if (opening) window.requestAnimationFrame(() => card?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const removeIngredient = (id: string) => setFormula((current) => current.filter((item) => item.id !== id));

  const openPicker = (category: string) => {
    setPickerCategory(category);
    setPickerSelection([]);
    setSearch("");
  };

  const addSelected = () => {
    setFormula((current) => [
      ...current,
      ...pickerSelection.filter((id) => !current.some((item) => item.id === id)).map((id) => ({ id, inclusion: 0 })),
    ]);
    setPickerCategory(null);
  };

  const resetFormula = () => {
    setFormula(INITIAL_FORMULA);
    setShowResults(false);
  };

  const saveResult = () => {
    const history = JSON.parse(localStorage.getItem("agricalc-history") || "[]");
    history.unshift({ savedAt: new Date().toISOString(), formula, totals });
    localStorage.setItem("agricalc-history", JSON.stringify(history.slice(0, 20)));
    setSaved(true);
  };

  const shareResult = async () => {
    const text = `Numega: Protein ${formatValue(totals["Crude Protein (%)"], "%")}% · ABC4 ${formatValue(totals["ABC4 (mEq/kg)"], "mEq/kg")} mEq/kg`;
    if (navigator.share) await navigator.share({ title: "Kết quả công thức Numega", text });
    else await navigator.clipboard.writeText(text);
  };

  const triggerInstall = async () => {
    if (!installPrompt) return;
    await (installPrompt as Event & { prompt: () => Promise<void> }).prompt();
    setInstallPrompt(null);
  };

  const logout = async () => {
    await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setAuthUser(null);
  };

  const detail = detailId ? rows.find((row) => row.id === detailId) : undefined;
  const totalAbc4 = totals["ABC4 (mEq/kg)"] || 0;
  const categoryMax = Math.max(0, ...categoryResults.map((item) => item.abc4));
  const categoryMin = Math.min(0, ...categoryResults.map((item) => item.abc4));
  const categoryRange = Math.max(1, categoryMax - categoryMin);
  const categoryZeroFromBottom = Math.abs(categoryMin) / categoryRange * 100;
  const categoryZeroFromTop = categoryMax / categoryRange * 100;
  const topContributors = [...rows]
    .map((row) => ({ ...row, abc4: numberValue(row.ingredient, "ABC4 (mEq/kg)") * row.inclusion / 100 }))
    .sort((a, b) => b.abc4 - a.abc4)
    .slice(0, 10);
  const topMax = Math.max(0, ...topContributors.map((item) => item.abc4));
  const topMin = Math.min(0, ...topContributors.map((item) => item.abc4));
  const topRange = Math.max(1, topMax - topMin);
  const topZero = topMax / topRange * 100;
  const negativeAbc4Rows = rows.filter((row) => row.inclusion > 0 && numberValue(row.ingredient, "ABC4 (mEq/kg)") < 0);

  return (
    <main className="app-shell">
      {!showResults ? (
        <>
          <header className="app-header">
            <a className="brand-lockup" href="/" aria-label="Numega"><img src="/numega-logo.png" alt="Numega" /></a>
            {authUser && (
              <div className="header-actions">
                {(!online || dataSource === "offline") && <span className="offline-pill">Dữ liệu offline</span>}
                {installPrompt && <button className="install-button" onClick={triggerInstall}>Cài app</button>}
                {authUser.role === "Admin" && <a className="admin-link" href="/admin" aria-label="Mở quản trị">⚙</a>}
                <button className="avatar-button" onClick={logout} aria-label={`Đăng xuất ${authUser.full_name}`} title="Đăng xuất">{authUser.full_name.split(" ").slice(-2).map((word) => word[0]).join("").toUpperCase()}</button>
              </div>
            )}
          </header>

          <section className={`mix-status ${isValid ? "valid" : "warning"}`}>
            <div className="mix-status-row">
              <div><span>Tổng tỷ lệ phối trộn</span><strong>{totalInclusion.toLocaleString("vi-VN")}%</strong></div>
              <p>{isValid ? "✓ Sẵn sàng tính" : totalInclusion < 100 ? `${(100 - totalInclusion).toLocaleString("vi-VN")}% còn thiếu` : `${(totalInclusion - 100).toLocaleString("vi-VN")}% vượt mức`}</p>
            </div>
            <div className="progress-track"><span style={{ width: `${Math.min(100, totalInclusion)}%` }} /></div>
            {!isValid && <small>Tổng tỷ lệ phải bằng đúng 100% trước khi tính.</small>}
          </section>

          <section className="builder-content" aria-label="Sáu nhóm nguyên liệu">
            {CATEGORY_ORDER.map((category, index) => {
              const categoryRows = rows.filter((row) => row.ingredient.Category === category);
              const categoryTotal = categoryRows.reduce((sum, row) => sum + row.inclusion, 0);
              const isOpen = expanded === category;
              return (
                <article className={`category-card ${isOpen ? "expanded" : ""}`} key={category}>
                  <button className="category-heading" onClick={(event) => toggleCategory(category, event)} aria-expanded={isOpen}>
                    <span className="chevron">›</span>
                    <span className="category-icon"><img src={icons[category]} alt="" aria-hidden="true" /></span>
                    <strong>{index + 1}. {CATEGORY_LABELS[category]}</strong>
                    <span className="count-badge">{categoryRows.length} NL · {categoryTotal.toLocaleString("vi-VN")}%</span>
                  </button>
                  {isOpen && (
                    <div className="category-body">
                      {categoryRows.length === 0 && <p className="empty-copy">Chưa có nguyên liệu trong nhóm này.</p>}
                      {categoryRows.map((row) => (
                        <div className="ingredient-row" key={row.id}>
                          <label htmlFor={`inc-${row.id}`}>
                            <span>{row.ingredient["Ingredient Name"]}</span>
                            <small>{row.ingredient["Scientific Name"]}</small>
                          </label>
                          <div className="ingredient-controls">
                            <div className="number-field"><input id={`inc-${row.id}`} inputMode="decimal" type="number" min="0" max="100" step="0.1" value={row.inclusion} onChange={(event) => updateInclusion(row.id, event.target.value)} /><span>%</span></div>
                            <button className="row-action info" aria-label={`Chi tiết ${row.ingredient["Ingredient Name"]}`} onClick={() => setDetailId(row.id)}>i</button>
                            <button className="row-action delete" aria-label={`Xóa ${row.ingredient["Ingredient Name"]}`} onClick={() => removeIngredient(row.id)}>×</button>
                          </div>
                        </div>
                      ))}
                      <button className="add-ingredient" onClick={() => openPicker(category)}><span>＋</span> Thêm nguyên liệu</button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <footer className="action-dock">
            <button className="secondary-button" onClick={resetFormula}>Reset</button>
            <button className="primary-button" disabled={!isValid} onClick={() => setShowResults(true)}><span>ϟ</span> Tính toán</button>
          </footer>
        </>
      ) : (
        <section className="results-page">
          <header className="results-header">
            <button className="icon-button" onClick={() => setShowResults(false)} aria-label="Quay lại">←</button>
            <div><span>Kết quả công thức</span><small>Tự động cập nhật từ tỷ lệ phối trộn</small></div>
            <button className="icon-button" onClick={shareResult} aria-label="Chia sẻ">↗</button>
          </header>
          <div className="results-content">
            <div className="success-pill">✓ Tổng tỷ lệ: 100%</div>
            <nav className="result-tabs" aria-label="Chế độ xem kết quả">
              <button className={resultTab === "overview" ? "active" : ""} onClick={() => setResultTab("overview")}>Tổng quan</button>
              <button className={resultTab === "groups" ? "active" : ""} onClick={() => setResultTab("groups")}>Chi tiết</button>
            </nav>

            {resultTab === "overview" && (
              <div className="result-stack">
                <ResultSection title="Chỉ số tổng quát">
                  <div className="metric-grid two">
                    <Metric label="ABC3" value={formatValue(totals["ABC3 (mEq/kg)"], "mEq/kg")} unit="mEq/kg" />
                    <Metric label="ABC4" value={formatValue(totals["ABC4 (mEq/kg)"], "mEq/kg")} unit="mEq/kg" />
                  </div>
                </ResultSection>
                <ResultSection title="Macro">
                  <div className="macro-grid">
                    {NUTRIENTS.slice(2, 6).map(([key, label]) => {
                      const value = totals[key];
                      return <div className="macro-item" key={key}><div><span>{label}</span><strong>{formatValue(value, "%")}%</strong></div><div className="micro-track"><span style={{ width: `${Math.min(100, Math.max(3, value))}%` }} /></div></div>;
                    })}
                  </div>
                </ResultSection>
                <ResultSection title="Khoáng chất">
                  <div className="metric-grid two soft">
                    <Metric label="Calcium" value={formatValue(totals["Calcium (%)"], "%")} unit="%" />
                    <Metric label="Phosphorus" value={formatValue(totals["Total Phosphorus (%)"], "%")} unit="%" />
                    <Metric label="Sodium" value={formatValue(totals["Sodium (%)"], "%")} unit="%" />
                  </div>
                </ResultSection>
                <ResultSection title="Giá trị năng lượng">
                  <div className="energy-card">
                    <Metric label="ME Poultry" value={formatValue(totals["ME Poultry (kcal/kg)"], "kcal/kg")} unit="kcal/kg" />
                    <Metric label="ME Swine" value={formatValue(totals["ME Swine (kcal/kg)"], "kcal/kg")} unit="kcal/kg" />
                  </div>
                </ResultSection>
              </div>
            )}

            {resultTab === "groups" && (
              <div className="detail-results">
                <ResultSection title="Đóng góp ABC4 theo nhóm">
                  {negativeAbc4Rows.length > 0 && (
                    <div className="chart-note warning">
                      <strong>Giá trị âm không phải lỗi.</strong>
                      <span>
                        {negativeAbc4Rows.map((row) => `${row.ingredient["Ingredient Name"]} ${(numberValue(row.ingredient, "ABC4 (mEq/kg)") * row.inclusion / 100).toFixed(1)} mEq/kg`).join(" · ")} đang làm giảm ABC4 tổng.
                      </span>
                    </div>
                  )}
                  <div className="category-summary-table">
                    <div className="summary-head"><span>Nhóm nguyên liệu</span><span>ABC4</span><span>% đóng góp</span></div>
                    {categoryResults.map((item) => {
                      const percent = Math.abs(totalAbc4) > 0.0000001 ? item.abc4 / totalAbc4 * 100 : null;
                      return <div className="summary-row" key={item.category}><strong>{CATEGORY_LABELS[item.category]}</strong><span className={item.abc4 < 0 ? "negative-value" : ""}>{item.abc4.toFixed(1)}</span><span className={percent !== null && percent < 0 ? "negative-value" : ""}>{percent === null ? "—" : `${percent.toFixed(1)}%`}</span></div>;
                    })}
                  </div>
                </ResultSection>

                <ResultSection title="ABC4 Contribution by Category">
                  <div className="category-column-chart" role="img" aria-label="Biểu đồ cột đóng góp ABC4 theo nhóm">
                    <div className="column-grid" />
                    <div className="column-series">
                      {categoryResults.map((item, index) => {
                        const height = Math.abs(item.abc4) / categoryRange * 100;
                        const colors = ["yellow", "green", "teal", "gray", "orange", "blue"];
                        return <div className="column-item" key={item.category}><div className="column-space"><span className="zero-axis" style={{ bottom: `${categoryZeroFromBottom}%` }} /><i className={`${item.abc4 < 0 ? "negative" : "positive"} ${colors[index]}`} style={item.abc4 < 0 ? { top: `${categoryZeroFromTop}%`, height: `${height}%` } : { bottom: `${categoryZeroFromBottom}%`, height: `${height}%` }}><b>{item.abc4.toFixed(1)}</b></i></div><span>{CATEGORY_LABELS[item.category]}</span></div>;
                      })}
                    </div>
                  </div>
                </ResultSection>

                <ResultSection title="Top 10 ABC4 Contributors">
                  <div className="top-table">
                    <div className="top-table-head"><span>Hạng</span><span>Nguyên liệu</span><span>Inclusion</span><span>ABC4</span></div>
                    {topContributors.map((item, index) => <div className="top-table-row" key={item.id}><span>{index + 1}</span><strong>{item.ingredient["Ingredient Name"]}</strong><span>{item.inclusion.toFixed(1)}%</span><span className={item.abc4 < 0 ? "negative-value" : ""}>{item.abc4.toFixed(1)}</span></div>)}
                    {Array.from({ length: Math.max(0, 10 - topContributors.length) }, (_, index) => <div className="top-table-row empty" key={`empty-${index}`}><span>{topContributors.length + index + 1}</span><strong>—</strong><span>—</span><span>—</span></div>)}
                  </div>
                </ResultSection>

                <ResultSection title="Top 10 ABC4 Contributors · Chart">
                  <div className="top-horizontal-chart" role="img" aria-label="Biểu đồ ngang Top 10 nguyên liệu đóng góp ABC4">
                    {[...topContributors].reverse().map((item) => {
                      const width = Math.abs(item.abc4) / topRange * 100;
                      return <div className="top-bar-row" key={item.id}><span>{item.ingredient["Ingredient Name"]}</span><div className="top-bar-track"><i className={item.abc4 < 0 ? "negative" : "positive"} style={item.abc4 < 0 ? { left: `${topZero}%`, width: `${width}%` } : { right: `${100 - topZero}%`, width: `${width}%` }} /><b style={{ left: `${topZero}%` }} /></div><strong className={item.abc4 < 0 ? "negative-value" : ""}>{item.abc4.toFixed(1)}</strong></div>;
                    })}
                  </div>
                </ResultSection>
              </div>
            )}

            <button className="save-button" onClick={saveResult}>▣ Lưu kết quả</button>
          </div>
        </section>
      )}

      {pickerCategory && (
        <div className="sheet-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickerCategory(null); }}>
          <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="picker-title">
            <div className="sheet-handle" />
            <header><h2 id="picker-title">Chọn nguyên liệu — {CATEGORY_LABELS[pickerCategory]}</h2><button onClick={() => setPickerCategory(null)} aria-label="Đóng">×</button></header>
            <label className="search-field"><span>⌕</span><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm nguyên liệu..." /></label>
            <div className="picker-list">
              {ingredients.filter((ingredient) => ingredient.Category === pickerCategory && ingredient["Ingredient Name"].toLowerCase().includes(search.toLowerCase())).map((ingredient) => {
                const id = ingredient["Ingredient ID"];
                const selected = pickerSelection.includes(id);
                const alreadyUsed = formula.some((item) => item.id === id);
                return <button disabled={alreadyUsed} className={selected ? "selected" : ""} key={id} onClick={() => setPickerSelection((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])}><span className="radio">{selected ? "●" : ""}</span><span><strong>{ingredient["Ingredient Name"]}</strong><em>{ingredient["Scientific Name"]}</em></span>{alreadyUsed && <small>Đã thêm</small>}</button>;
              })}
            </div>
            <button className="sheet-primary" disabled={pickerSelection.length === 0} onClick={addSelected}>Thêm vào công thức ({pickerSelection.length})</button>
          </section>
        </div>
      )}

      {detail && (
        <div className="sheet-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailId(null); }}>
          <section className="bottom-sheet detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="sheet-handle" />
            <header><div><h2 id="detail-title">{detail.ingredient["Ingredient Name"]}</h2><p><i>{detail.ingredient["Scientific Name"]}</i> · {CATEGORY_LABELS[detail.ingredient.Category]} · {detail.ingredient.Origin}</p></div><button onClick={() => setDetailId(null)} aria-label="Đóng">×</button></header>
            <h3><MiniIcon>▥</MiniIcon> Đóng góp theo tỷ lệ hiện tại ({detail.inclusion}%)</h3>
            <div className="detail-metrics">
              {[NUTRIENTS[1], NUTRIENTS[2], NUTRIENTS[3], NUTRIENTS[9]].map(([key, label, unit]) => <Metric key={key} label={label} value={formatValue(numberValue(detail.ingredient, key) * detail.inclusion / 100, unit)} unit={unit} />)}
            </div>
            <h3 className="reference-title"><MiniIcon>▤</MiniIcon> Thông số tham khảo (database gốc)</h3>
            <div className="reference-grid">
              {["Dry Matter (%)", "Moisture (%)", "Lysine (%)", "Methionine (%)", "Threonine (%)", "Valine (%)"].map((key) => <div key={key}><span>{key.replace(" (%)", "")}</span><strong>{numberValue(detail.ingredient, key).toFixed(2)}%</strong></div>)}
            </div>
            <div className="detail-actions"><button onClick={() => setDetailId(null)}>Đóng</button><button onClick={() => setDetailId(null)}>Sử dụng nguyên liệu</button></div>
          </section>
        </div>
      )}

      {saved && (
        <div className="toast" role="status"><span>✓</span><div><strong>Đã lưu kết quả</strong><small>Dữ liệu được lưu trên thiết bị và dùng được khi offline.</small></div><button onClick={() => setSaved(false)}>×</button></div>
      )}
    </main>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="result-section"><h2>{title}</h2><div className="result-card">{children}</div></section>;
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return <div className="metric"><span>{label}</span><div><strong>{value}</strong><small>{unit}</small></div></div>;
}
