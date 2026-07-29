"use client";

import Link from "next/link";
import Image from "next/image";
import { type MouseEvent, useEffect, useMemo, useState } from "react";
import rawIngredients from "./data/ingredients.json";
import { apiRequest } from "./lib/api";

type Ingredient = (typeof rawIngredients)[number];
type FormulaItem = { id: string; inclusion: number };
type ResultTab = "overview" | "groups";
type AuthUser = { id: string; full_name: string; email: string; role: "Admin" | "User"; status: string };
type Category = { id: string; slug: string; name: string; sort_order: number; show_in_calculator: boolean; icon: string };
type CategoryResult = { category: string; inclusion: number; abc3: number; abc4: number };
type ChartMetric = "ABC3" | "ABC4";
type ChartCategoryItem = { category: string; value: number; color: string };

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cereals", slug: "cereals", name: "Cereals", sort_order: 1, show_in_calculator: true, icon: "/icons/categories/cereals.png" },
  { id: "protein-sources", slug: "protein-sources", name: "Protein Sources", sort_order: 2, show_in_calculator: true, icon: "/icons/categories/protein-sources.png" },
  { id: "energy-oils-fats", slug: "energy-oils-fats", name: "Energy (Oils & Fats)", sort_order: 3, show_in_calculator: true, icon: "/icons/categories/oils-fats.png" },
  { id: "minerals", slug: "minerals", name: "Minerals", sort_order: 4, show_in_calculator: true, icon: "/icons/categories/minerals.png" },
  { id: "amino-acids", slug: "amino-acids", name: "Amino Acids", sort_order: 5, show_in_calculator: true, icon: "/icons/categories/amino-acids.png" },
  { id: "others", slug: "others", name: "Others", sort_order: 6, show_in_calculator: true, icon: "/icons/categories/others.png" },
];

const NUTRIENTS = [
  ["ABC3 (mEq/kg)", "ABC3", "meq/kg"],
  ["ABC4 (mEq/kg)", "ABC4", "meq/kg"],
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

function numberValue(ingredient: Ingredient, key: string) {
  const value = ingredient[key as keyof Ingredient];
  return typeof value === "number" ? value : Number(value) || 0;
}

function formatValue(value: number, unit: string) {
  if (unit === "kcal/kg" || unit === "meq/kg") return Math.round(value).toLocaleString("en-US");
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MiniIcon({ children }: { children: React.ReactNode }) {
  return <span className="mini-icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>(rawIngredients);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [dataSource, setDataSource] = useState<"database" | "offline">("offline");
  const [formula, setFormula] = useState<FormulaItem[]>(INITIAL_FORMULA);
  const [inclusionDrafts, setInclusionDrafts] = useState<Record<string, string>>({});
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
    const cachedCategories = localStorage.getItem("numega-calculator-categories");
    if (cachedCategories) {
      try { setCategories(JSON.parse(cachedCategories)); } catch { /* use embedded categories */ }
    }
    apiRequest<Ingredient[]>("/api/ingredients?active=true")
      .then((databaseIngredients) => {
        setIngredients(databaseIngredients);
        setDataSource("database");
        localStorage.setItem("numega-ingredients", JSON.stringify(databaseIngredients));
      })
      .catch(() => setDataSource("offline"));
    apiRequest<Category[]>("/api/categories?calculator=true")
      .then((databaseCategories) => {
        setCategories(databaseCategories);
        localStorage.setItem("numega-calculator-categories", JSON.stringify(databaseCategories));
      })
      .catch(() => undefined);
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

  useEffect(() => {
    setExpanded((current) => categories.some((category) => category.name === current) ? current : (categories[0]?.name || ""));
  }, [categories]);

  const ingredientMap = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient["Ingredient ID"], ingredient])),
    [ingredients],
  );

  const allRows = useMemo(
    () => formula.map((item) => ({ ...item, ingredient: ingredientMap.get(item.id)! })).filter((row) => row.ingredient),
    [formula, ingredientMap],
  );
  const enabledCategoryNames = useMemo(() => new Set(categories.map((category) => category.name)), [categories]);
  const rows = useMemo(
    () => allRows.filter((row) => enabledCategoryNames.has(row.ingredient.Category)),
    [allRows, enabledCategoryNames],
  );

  const totalInclusion = useMemo(() => rows.reduce((sum, item) => sum + item.inclusion, 0), [rows]);
  const isValid = Math.abs(totalInclusion - 100) < 0.0001;

  const totals = useMemo(() => {
    return Object.fromEntries(NUTRIENTS.map(([key]) => [key, rows.reduce((sum, row) => sum + numberValue(row.ingredient, key) * row.inclusion / 100, 0)]));
  }, [rows]);

  const categoryResults = useMemo(() => categories.map((category) => {
    const categoryRows = rows.filter((row) => row.ingredient.Category === category.name);
    return {
      category: category.name,
      inclusion: categoryRows.reduce((sum, row) => sum + row.inclusion, 0),
      abc3: categoryRows.reduce((sum, row) => sum + numberValue(row.ingredient, "ABC3 (mEq/kg)") * row.inclusion / 100, 0),
      abc4: categoryRows.reduce((sum, row) => sum + numberValue(row.ingredient, "ABC4 (mEq/kg)") * row.inclusion / 100, 0),
    };
  }), [categories, rows]);

  const updateInclusion = (id: string, value: string) => {
    setInclusionDrafts((current) => ({ ...current, [id]: value }));
    const parsed = Math.max(0, Math.min(100, Number(value) || 0));
    setFormula((current) => current.map((item) => item.id === id ? { ...item, inclusion: parsed } : item));
  };

  const finishInclusionEdit = (id: string) => {
    setInclusionDrafts((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const toggleCategory = (category: string, event: MouseEvent<HTMLButtonElement>) => {
    const opening = expanded !== category;
    const card = event.currentTarget.closest(".category-card");
    setExpanded(opening ? category : "");
    if (opening) window.requestAnimationFrame(() => card?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const removeIngredient = (id: string) => {
    setFormula((current) => current.filter((item) => item.id !== id));
    finishInclusionEdit(id);
  };

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
    setInclusionDrafts({});
    setShowResults(false);
  };

  const saveResult = () => {
    const history = JSON.parse(localStorage.getItem("agricalc-history") || "[]");
    history.unshift({ savedAt: new Date().toISOString(), formula, totals });
    localStorage.setItem("agricalc-history", JSON.stringify(history.slice(0, 20)));
    setSaved(true);
  };

  const shareResult = async () => {
    const text = `Numega: Protein ${formatValue(totals["Crude Protein (%)"], "%")}% · ABC4 ${formatValue(totals["ABC4 (mEq/kg)"], "meq/kg")} meq/kg`;
    if (navigator.share) await navigator.share({ title: "Numega Formula Results", text });
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
            <Link className="brand-lockup" href="/" aria-label="Numega"><Image src="/numega-logo.png" alt="Numega" width={588} height={126} priority /></Link>
            {authUser && (
              <div className="header-actions">
                {(!online || dataSource === "offline") && <span className="offline-pill">Offline data</span>}
                {installPrompt && <button className="install-button" onClick={triggerInstall}>Install app</button>}
                {authUser.role === "Admin" && <Link className="admin-link" href="/admin" aria-label="Open administration">⚙</Link>}
                <button className="avatar-button" onClick={logout} aria-label={`Sign out ${authUser.full_name}`} title="Sign out">{authUser.full_name.split(" ").slice(-2).map((word) => word[0]).join("").toUpperCase()}</button>
              </div>
            )}
          </header>

          <section className={`mix-status ${isValid ? "valid" : "warning"}`}>
            <div className="mix-status-row">
              <div><span>Total inclusion</span><strong>{totalInclusion.toLocaleString("en-US")}%</strong></div>
              <p>{isValid ? "✓ At the 100% target" : totalInclusion < 100 ? `${(100 - totalInclusion).toLocaleString("en-US")}% below target` : `${(totalInclusion - 100).toLocaleString("en-US")}% above target`}</p>
            </div>
            <div className="progress-track"><span style={{ width: `${Math.min(100, totalInclusion)}%` }} /></div>
            {!isValid && <small>You can still calculate with the current total inclusion.</small>}
          </section>

          <section className="builder-content" aria-label="Enabled ingredient categories">
            {categories.map((category, index) => {
              const categoryRows = rows.filter((row) => row.ingredient.Category === category.name);
              const categoryTotal = categoryRows.reduce((sum, row) => sum + row.inclusion, 0);
              const isOpen = expanded === category.name;
              return (
                <article className={`category-card ${isOpen ? "expanded" : ""}`} key={category.id}>
                  <button className="category-heading" onClick={(event) => toggleCategory(category.name, event)} aria-expanded={isOpen}>
                    <span className="chevron">›</span>
                    <span className="category-icon"><Image src={category.icon || "/icons/categories/others.png"} alt="" aria-hidden="true" width={64} height={64} /></span>
                    <strong>{index + 1}. {category.name}</strong>
                    <span className="count-badge">{categoryRows.length} items · {categoryTotal.toLocaleString("en-US")}%</span>
                  </button>
                  {isOpen && (
                    <div className="category-body">
                      {categoryRows.length === 0 && <p className="empty-copy">No ingredients in this category.</p>}
                      {categoryRows.map((row) => (
                        <div className="ingredient-row" key={row.id}>
                          <label htmlFor={`inc-${row.id}`}>
                            <span>{row.ingredient["Ingredient Name"]}</span>
                            <small>{row.ingredient["Scientific Name"]}</small>
                          </label>
                          <div className="ingredient-controls">
                            <div className="number-field"><input id={`inc-${row.id}`} inputMode="decimal" type="number" min="0" max="100" step="0.1" value={inclusionDrafts[row.id] ?? (row.inclusion === 0 ? "" : String(row.inclusion))} placeholder="0" onChange={(event) => updateInclusion(row.id, event.target.value)} onBlur={() => finishInclusionEdit(row.id)} /><span>%</span></div>
                            <button className="row-action info" aria-label={`View details for ${row.ingredient["Ingredient Name"]}`} onClick={() => setDetailId(row.id)}>i</button>
                            <button className="row-action delete" aria-label={`Remove ${row.ingredient["Ingredient Name"]}`} onClick={() => removeIngredient(row.id)}>×</button>
                          </div>
                        </div>
                      ))}
                      <button className="add-ingredient" onClick={() => openPicker(category.name)}><span>＋</span> Add ingredient</button>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <footer className="action-dock">
            <button className="secondary-button" onClick={resetFormula}>Reset</button>
            <button className="primary-button" onClick={() => setShowResults(true)}><span>ϟ</span> Calculate</button>
          </footer>
        </>
      ) : (
        <section className="results-page">
          <header className="results-header">
            <button className="icon-button" onClick={() => setShowResults(false)} aria-label="Go back">←</button>
            <div><span>Formula Results</span><small>Automatically updated from inclusion rates</small></div>
            <button className="icon-button" onClick={shareResult} aria-label="Share">↗</button>
          </header>
          <div className="results-content">
            <div className="success-pill">Total inclusion: {totalInclusion.toLocaleString("en-US")}%</div>
            <nav className="result-tabs" aria-label="Result view">
              <button className={resultTab === "overview" ? "active" : ""} onClick={() => setResultTab("overview")}>Overview</button>
              <button className={resultTab === "groups" ? "active" : ""} onClick={() => setResultTab("groups")}>Details</button>
            </nav>

            {resultTab === "overview" && (
              <div className="result-stack">
                <ResultSection title="General Indicators">
                  <div className="metric-grid two">
                    <Metric label="ABC3" value={formatValue(totals["ABC3 (mEq/kg)"], "meq/kg")} unit="meq/kg" />
                    <Metric label="ABC4" value={formatValue(totals["ABC4 (mEq/kg)"], "meq/kg")} unit="meq/kg" />
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
                <ResultSection title="Minerals">
                  <div className="metric-grid two soft">
                    <Metric label="Calcium" value={formatValue(totals["Calcium (%)"], "%")} unit="%" />
                    <Metric label="Phosphorus" value={formatValue(totals["Total Phosphorus (%)"], "%")} unit="%" />
                    <Metric label="Sodium" value={formatValue(totals["Sodium (%)"], "%")} unit="%" />
                  </div>
                </ResultSection>
                <ResultSection title="Energy Values">
                  <div className="energy-card">
                    <Metric label="ME Poultry" value={formatValue(totals["ME Poultry (kcal/kg)"], "kcal/kg")} unit="kcal/kg" />
                    <Metric label="ME Swine" value={formatValue(totals["ME Swine (kcal/kg)"], "kcal/kg")} unit="kcal/kg" />
                  </div>
                </ResultSection>
              </div>
            )}

            {resultTab === "groups" && (
              <div className="detail-results">
                <ResultSection title="ABC3 & ABC4 Contribution by Category">
                  {negativeAbc4Rows.length > 0 && (
                    <div className="chart-note warning">
                      <strong>Negative values are not errors.</strong>
                      <span>
                        {negativeAbc4Rows.map((row) => `${row.ingredient["Ingredient Name"]} ${(numberValue(row.ingredient, "ABC4 (mEq/kg)") * row.inclusion / 100).toFixed(1)} meq/kg`).join(" · ")} reduce the total ABC4 value.
                      </span>
                    </div>
                  )}
                  <div className="category-summary-table">
                    <div className="summary-head"><span>Ingredient Category</span><span>ABC3</span><span>ABC4</span><span>%</span></div>
                    {categoryResults.map((item) => {
                      const percent = Math.abs(totalAbc4) > 0.0000001 ? item.abc4 / totalAbc4 * 100 : null;
                      return <div className="summary-row" key={item.category}><strong>{item.category}</strong><span className={item.abc3 < 0 ? "negative-value" : ""}>{item.abc3.toFixed(1)}</span><span className={item.abc4 < 0 ? "negative-value" : ""}>{item.abc4.toFixed(1)}</span><span className={percent !== null && percent < 0 ? "negative-value" : ""}>{percent === null ? "—" : `${percent.toFixed(1)}%`}</span></div>;
                    })}
                  </div>
                </ResultSection>

                <ResultSection title="ABC4 Contribution by Category">
                  <CategoryWaterfallChart items={categoryResults} metric="ABC4" />
                </ResultSection>

                <ResultSection title="ABC3 Contribution by Category">
                  <CategoryWaterfallChart items={categoryResults} metric="ABC3" />
                </ResultSection>

                <ResultSection title="Top 10 ABC4 Contributors">
                  <div className="top-table">
                    <div className="top-table-head"><span>Rank</span><span>Ingredient</span><span>Inclusion</span><span>ABC4</span></div>
                    {topContributors.map((item, index) => <div className="top-table-row" key={item.id}><span>{index + 1}</span><strong>{item.ingredient["Ingredient Name"]}</strong><span>{item.inclusion.toFixed(1)}%</span><span className={item.abc4 < 0 ? "negative-value" : ""}>{item.abc4.toFixed(1)}</span></div>)}
                    {Array.from({ length: Math.max(0, 10 - topContributors.length) }, (_, index) => <div className="top-table-row empty" key={`empty-${index}`}><span>{topContributors.length + index + 1}</span><strong>—</strong><span>—</span><span>—</span></div>)}
                  </div>
                </ResultSection>

                <ResultSection title="Top 10 ABC4 Contributors · Chart">
                  <div className="top-horizontal-chart" role="img" aria-label="Horizontal chart of the top 10 ABC4-contributing ingredients">
                    {[...topContributors].reverse().map((item) => {
                      const width = Math.abs(item.abc4) / topRange * 100;
                      return <div className="top-bar-row" key={item.id}><span>{item.ingredient["Ingredient Name"]}</span><div className="top-bar-track"><i className={item.abc4 < 0 ? "negative" : "positive"} style={item.abc4 < 0 ? { left: `${topZero}%`, width: `${width}%` } : { right: `${100 - topZero}%`, width: `${width}%` }} /><b style={{ left: `${topZero}%` }} /></div><strong className={item.abc4 < 0 ? "negative-value" : ""}>{item.abc4.toFixed(1)}</strong></div>;
                    })}
                  </div>
                </ResultSection>
              </div>
            )}

            <button className="save-button" onClick={saveResult}>▣ Save Results</button>
          </div>
        </section>
      )}

      {pickerCategory && (
        <div className="sheet-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickerCategory(null); }}>
          <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="picker-title">
            <div className="sheet-handle" />
            <header><h2 id="picker-title">Select Ingredients — {pickerCategory}</h2><button onClick={() => setPickerCategory(null)} aria-label="Close">×</button></header>
            <label className="search-field"><span>⌕</span><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ingredients..." /></label>
            <div className="picker-list">
              {ingredients.filter((ingredient) => ingredient.Category === pickerCategory && ingredient["Ingredient Name"].toLowerCase().includes(search.toLowerCase())).map((ingredient) => {
                const id = ingredient["Ingredient ID"];
                const selected = pickerSelection.includes(id);
                const alreadyUsed = formula.some((item) => item.id === id);
                return <button disabled={alreadyUsed} className={selected ? "selected" : ""} key={id} onClick={() => setPickerSelection((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])}><span className="radio">{selected ? "●" : ""}</span><span><strong>{ingredient["Ingredient Name"]}</strong><em>{ingredient["Scientific Name"]}</em></span>{alreadyUsed && <small>Added</small>}</button>;
              })}
            </div>
            <button className="sheet-primary" disabled={pickerSelection.length === 0} onClick={addSelected}>Add to Formula ({pickerSelection.length})</button>
          </section>
        </div>
      )}

      {detail && (
        <div className="sheet-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailId(null); }}>
          <section className="bottom-sheet detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <div className="sheet-handle" />
            <header><div><h2 id="detail-title">{detail.ingredient["Ingredient Name"]}</h2><p><i>{detail.ingredient["Scientific Name"]}</i> · {detail.ingredient.Category} · {detail.ingredient.Origin}</p></div><button onClick={() => setDetailId(null)} aria-label="Close">×</button></header>
            <h3><MiniIcon>▥</MiniIcon> Contribution at Current Inclusion ({detail.inclusion}%)</h3>
            <div className="detail-metrics">
              {[NUTRIENTS[1], NUTRIENTS[2], NUTRIENTS[3], NUTRIENTS[9]].map(([key, label, unit]) => <Metric key={key} label={label} value={formatValue(numberValue(detail.ingredient, key) * detail.inclusion / 100, unit)} unit={unit} />)}
            </div>
            <h3 className="reference-title"><MiniIcon>▤</MiniIcon> Reference Values (Source Database)</h3>
            <div className="reference-grid">
              {["Dry Matter (%)", "Moisture (%)", "Lysine (%)", "Methionine (%)", "Threonine (%)", "Valine (%)"].map((key) => <div key={key}><span>{key.replace(" (%)", "")}</span><strong>{numberValue(detail.ingredient, key).toFixed(2)}%</strong></div>)}
            </div>
            <div className="detail-actions"><button onClick={() => setDetailId(null)}>Close</button><button onClick={() => setDetailId(null)}>Use Ingredient</button></div>
          </section>
        </div>
      )}

      {saved && (
        <div className="toast" role="status"><span>✓</span><div><strong>Results Saved</strong><small>Data is stored on this device and remains available offline.</small></div><button onClick={() => setSaved(false)}>×</button></div>
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

function CategoryWaterfallChart({ items, metric }: { items: CategoryResult[]; metric: ChartMetric }) {
  const negativeColors = ["#dc3f32", "#e8732f", "#b82f52"];
  const positiveColors = ["#48545d", "#8d321e", "#2f806c", "#c29426", "#547faf", "#785ca0"];
  const chartItems = items.map((item) => ({ category: item.category, value: metric === "ABC3" ? item.abc3 : item.abc4 }));
  const negativeItems = chartItems.filter((item) => item.value < 0).map((item, index) => ({ ...item, color: negativeColors[index % negativeColors.length] }));
  const positiveItems = chartItems.filter((item) => item.value > 0).map((item, index) => ({ ...item, color: positiveColors[index % positiveColors.length] }));
  const zeroItems = chartItems.filter((item) => Math.abs(item.value) < 0.0000001).map((item) => ({ ...item, color: "#b7c0bb" }));
  const negativeTotal = negativeItems.reduce((sum, item) => sum + item.value, 0);
  const finalTotal = chartItems.reduce((sum, item) => sum + item.value, 0);
  const domainMin = Math.min(0, negativeTotal);
  const domainMax = Math.max(0, finalTotal);
  const rawRange = Math.max(1, domainMax - domainMin);
  const roughStep = rawRange / 4;
  const stepPower = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / stepPower;
  const niceStep = (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10) * stepPower;
  const chartMin = Math.min(0, Math.floor(domainMin / niceStep) * niceStep);
  const chartMax = Math.max(niceStep, Math.ceil(domainMax / niceStep) * niceStep);
  const chartRange = chartMax - chartMin;
  const axisTicks = Array.from({ length: Math.round(chartRange / niceStep) + 1 }, (_, index) => chartMin + index * niceStep);
  const bottomAt = (value: number) => (value - chartMin) / chartRange * 100;
  const heightOf = (value: number) => Math.abs(value) / chartRange * 100;
  const negativeSegments = negativeItems.map((item, index) => {
    const previous = negativeItems.slice(0, index).reduce((sum, segment) => sum + segment.value, 0);
    const next = previous + item.value;
    const segment = { ...item, bottom: bottomAt(next), height: heightOf(item.value) };
    return segment;
  });
  const positiveSegments = positiveItems.map((item, index) => {
    const previous = positiveItems.slice(0, index).reduce((sum, segment) => sum + segment.value, 0);
    return { ...item, bottom: bottomAt(negativeTotal + previous), height: heightOf(item.value) };
  });
  const legendItems = [...negativeItems, ...positiveItems, ...zeroItems];
  const accessibleSummary = `${metric} category waterfall. Negative total ${negativeTotal.toFixed(1)} meq/kg. Positive categories start at the negative total. Final total ${finalTotal.toFixed(1)} meq/kg.`;

  return (
    <div className="waterfall-chart">
      <div className="waterfall-summary"><span>Current</span><strong>{finalTotal.toFixed(1)} <small>meq/kg</small></strong></div>
      <div className="waterfall-body">
        <div className="waterfall-plot" role="img" aria-label={accessibleSummary}>
          <div className="waterfall-chart-area">
            <div className="waterfall-grid">{axisTicks.map((tick) => <span key={tick} style={{ bottom: `${bottomAt(tick)}%` }} />)}</div>
            <div className="waterfall-y-axis" aria-hidden="true">{axisTicks.map((tick) => <span key={tick} style={{ bottom: `${bottomAt(tick)}%` }}>{tick.toLocaleString("en-US")}</span>)}</div>
            <span className="waterfall-zero-axis" style={{ bottom: `${bottomAt(0)}%` }}><b>0</b></span>
            <div className="waterfall-stack waterfall-negative-stack" aria-hidden="true">
              {negativeSegments.map((item) => <i key={item.category} style={{ bottom: `${item.bottom}%`, height: `${item.height}%`, backgroundColor: item.color }} />)}
            </div>
            <div className="waterfall-stack waterfall-positive-stack" aria-hidden="true">
              {positiveSegments.map((item) => <i key={item.category} style={{ bottom: `${item.bottom}%`, height: `${item.height}%`, backgroundColor: item.color }} />)}
              <strong className={`waterfall-total ${finalTotal < 0 ? "negative" : ""}`} style={{ bottom: `${bottomAt(finalTotal)}%` }}>Σ={finalTotal.toFixed(1)}</strong>
            </div>
          </div>
        </div>
        <aside className="waterfall-legend" aria-label="ABC4 contribution values by ingredient category">
          {legendItems.map((item) => <CategoryLegendRow item={item} key={item.category} />)}
        </aside>
      </div>
    </div>
  );
}

function CategoryLegendRow({ item }: { item: ChartCategoryItem }) {
  return <div className="waterfall-category-row"><i style={{ backgroundColor: item.color }} /><b>{item.category}</b><small className={item.value < 0 ? "negative-value" : ""}>{item.value.toFixed(1)} <em>meq/kg</em></small></div>;
}
