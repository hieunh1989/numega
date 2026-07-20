"use client";

import { useEffect, useMemo, useState } from "react";
import rawIngredients from "./data/ingredients.json";

type Ingredient = (typeof rawIngredients)[number];
type FormulaItem = { id: string; inclusion: number };
type ResultTab = "overview" | "groups" | "top";

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
  Cereals: "🌾",
  "Protein Sources": "◉",
  "Energy (Oils & Fats)": "●",
  Minerals: "◇",
  "Amino Acids": "Aa",
  Others: "+",
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
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
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
    () => new Map(rawIngredients.map((ingredient) => [ingredient["Ingredient ID"], ingredient])),
    [],
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
      protein: categoryRows.reduce((sum, row) => sum + numberValue(row.ingredient, "Crude Protein (%)") * row.inclusion / 100, 0),
    };
  }), [rows]);

  const updateInclusion = (id: string, value: string) => {
    const parsed = Math.max(0, Math.min(100, Number(value) || 0));
    setFormula((current) => current.map((item) => item.id === id ? { ...item, inclusion: parsed } : item));
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
    const text = `AgriCalc: Protein ${formatValue(totals["Crude Protein (%)"], "%")}% · ABC4 ${formatValue(totals["ABC4 (mEq/kg)"], "mEq/kg")} mEq/kg`;
    if (navigator.share) await navigator.share({ title: "Kết quả công thức AgriCalc", text });
    else await navigator.clipboard.writeText(text);
  };

  const triggerInstall = async () => {
    if (!installPrompt) return;
    await (installPrompt as Event & { prompt: () => Promise<void> }).prompt();
    setInstallPrompt(null);
  };

  const detail = detailId ? rows.find((row) => row.id === detailId) : undefined;
  const maxAbc4 = Math.max(1, ...categoryResults.map((item) => Math.abs(item.abc4)));
  const maxProtein = Math.max(1, ...categoryResults.map((item) => Math.abs(item.protein)));

  return (
    <main className="app-shell">
      {!showResults ? (
        <>
          <header className="app-header">
            <button className="icon-button" aria-label="Mở menu"><span>☰</span></button>
            <div className="brand-lockup">
              <span className="brand-mark">A</span>
              <div><p>AgriCalc</p><h1>Feed Formula Calculator</h1></div>
            </div>
            <div className="header-actions">
              {!online && <span className="offline-pill">Offline</span>}
              {installPrompt && <button className="install-button" onClick={triggerInstall}>Cài app</button>}
              <button className="avatar-button" aria-label="Tài khoản">AN</button>
            </div>
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
                  <button className="category-heading" onClick={() => setExpanded(isOpen ? "" : category)} aria-expanded={isOpen}>
                    <span className="chevron">›</span>
                    <span className="category-icon">{icons[category]}</span>
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
              <button className={resultTab === "groups" ? "active" : ""} onClick={() => setResultTab("groups")}>Nhóm chất</button>
              <button className={resultTab === "top" ? "active" : ""} onClick={() => setResultTab("top")}>Top NL</button>
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
              <div className="chart-stack">
                <ResultSection title="Biểu đồ Bar · Đóng góp ABC4">
                  <div className="bar-chart">
                    {categoryResults.map((item) => <div className="bar-row" key={item.category}><span>{CATEGORY_LABELS[item.category]}</span><div><i style={{ width: `${Math.abs(item.abc4) / maxAbc4 * 100}%` }} /></div><strong>{item.abc4.toFixed(1)}</strong></div>)}
                  </div>
                </ResultSection>
                <ResultSection title="Biểu đồ Line · Protein theo nhóm">
                  <div className="line-chart" aria-label="Biểu đồ đường đóng góp protein">
                    <div className="line-grid" />
                    {categoryResults.map((item, index) => {
                      const x = categoryResults.length === 1 ? 0 : index / (categoryResults.length - 1) * 100;
                      const y = 100 - item.protein / maxProtein * 82 - 9;
                      const next = categoryResults[index + 1];
                      const nextX = next ? (index + 1) / (categoryResults.length - 1) * 100 : x;
                      const nextY = next ? 100 - next.protein / maxProtein * 82 - 9 : y;
                      const width = Math.hypot(nextX - x, nextY - y);
                      const angle = Math.atan2(nextY - y, nextX - x) * 180 / Math.PI;
                      return <div key={item.category}><span className="line-point" style={{ left: `${x}%`, top: `${y}%` }} title={`${CATEGORY_LABELS[item.category]}: ${item.protein.toFixed(2)}%`} />{next && <i className="line-segment" style={{ left: `${x}%`, top: `${y}%`, width: `${width}%`, transform: `rotate(${angle}deg)` }} />}</div>;
                    })}
                  </div>
                  <div className="line-labels">{categoryResults.map((item) => <span key={item.category}>{CATEGORY_LABELS[item.category].split(" ")[0]}</span>)}</div>
                </ResultSection>
              </div>
            )}

            {resultTab === "top" && (
              <ResultSection title="Xếp hạng đóng góp ABC4">
                <div className="ranking-list">
                  {[...rows].sort((a, b) => numberValue(b.ingredient, "ABC4 (mEq/kg)") * b.inclusion - numberValue(a.ingredient, "ABC4 (mEq/kg)") * a.inclusion).map((row, index) => (
                    <div className="ranking-row" key={row.id}><span>{index + 1}</span><div><strong>{row.ingredient["Ingredient Name"]}</strong><small>{row.inclusion}% tỷ lệ phối trộn</small></div><b>{(numberValue(row.ingredient, "ABC4 (mEq/kg)") * row.inclusion / 100).toFixed(1)} <em>mEq/kg</em></b></div>
                  ))}
                </div>
              </ResultSection>
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
              {rawIngredients.filter((ingredient) => ingredient.Category === pickerCategory && ingredient["Ingredient Name"].toLowerCase().includes(search.toLowerCase())).map((ingredient) => {
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
