"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  FileUp,
  GitBranch,
  Network,
  Play,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  apriori,
  categoricalAssociation,
  dataQuality,
  decisionTreeEvaluation,
  kModes,
  olap,
  parseCSV,
  type Row,
} from "@/lib/dma";

const panel = "glass-panel rounded-2xl border border-white/10 p-5";
const field =
  "mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const mutedButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-white/5 disabled:opacity-40";

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const content = [
    keys.map(escape).join(","),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export default function DataMiningLab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [module, setModule] = useState("quality");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [minSupport, setMinSupport] = useState("0.1");
  const [minConfidence, setMinConfidence] = useState("0.5");
  const [minLift, setMinLift] = useState("1");
  const [clusterCount, setClusterCount] = useState("3");
  const [attributeA, setAttributeA] = useState("");
  const [attributeB, setAttributeB] = useState("");
  const [target, setTarget] = useState("");
  const [dimension, setDimension] = useState("");
  const [measure, setMeasure] = useState("");
  const [result, setResult] = useState<any>(null);
  const [runError, setRunError] = useState("");
  const columns = useMemo(
    () => (rows.length ? Object.keys(rows[0]) : []),
    [rows],
  );
  const quality = useMemo(
    () => (rows.length ? dataQuality(rows, columns) : null),
    [rows, columns],
  );
  const numericColumns = useMemo(
    () =>
      columns.filter((c) =>
        rows.some((r) => r[c]?.trim() && Number.isFinite(Number(r[c]))),
      ),
    [rows, columns],
  );

  async function loadFile(file?: File) {
    if (!file) return;
    setError("");
    setRunError("");
    setResult(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError(
        "Please export the workbook/sheet as CSV UTF-8 and upload that .csv file. This browser-only importer intentionally does not guess at binary Excel contents.",
      );
      return;
    }
    try {
      const parsed = parseCSV(await file.text());
      if (parsed.length > 100000)
        throw new Error(
          "For this browser-based lab, please use a CSV with 100,000 rows or fewer.",
        );
      const cols = Object.keys(parsed[0] ?? {});
      if (cols.length < 2)
        throw new Error("At least two columns are required for DMA analysis.");
      setRows(parsed);
      setFileName(file.name);
      setSelectedColumns(cols.slice(0, Math.min(cols.length, 6)));
      setAttributeA(cols[0]);
      setAttributeB(cols[1]);
      setTarget(cols.find((c) => parsed.some((r: { [x: string]: string; }) => r[c]?.trim())) ?? cols[0]);
      setDimension(cols[0]);
      setMeasure("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to read this CSV file.",
      );
    }
  }
  function run(fn: () => unknown) {
    setRunError("");
    setResult(null);
    try {
      setResult(fn());
    } catch (e) {
      setRunError(
        e instanceof Error ? e.message : "Analysis could not be completed.",
      );
    }
  }
  const modules = [
    {
      id: "quality",
      label: "Data quality",
      icon: Database,
      desc: "Missing values, duplicates and cardinality",
    },
    {
      id: "association",
      label: "Association rules",
      icon: Network,
      desc: "Apriori · support, confidence and lift",
    },
    {
      id: "segmentation",
      label: "Segmentation",
      icon: Users,
      desc: "Categorical k-modes clustering",
    },
    {
      id: "relationship",
      label: "Relationships",
      icon: Activity,
      desc: "Chi-square and Cramér’s V",
    },
    {
      id: "prediction",
      label: "Classification",
      icon: GitBranch,
      desc: "Interpretable decision tree evaluation",
    },
    {
      id: "olap",
      label: "OLAP explorer",
      icon: BarChart3,
      desc: "Slice, group and roll up records",
    },
  ];
  const activeModule = modules.find((m) => m.id === module) ?? modules[0];

  return (
    <div className="flex flex-col gap-6">
      <section className={`${panel} bg-primary/[0.035]`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/15 p-3 text-primary">
              <Database className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                Data mining workbench
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Bring your respondent-level data
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Upload a CSV exported from your original survey workbook. All
                algorithms run on the uploaded rows in your browser; aggregate
                summary counts alone cannot produce respondent-level patterns.
              </p>
            </div>
          </div>
          <label className={button}>
            <FileUp className="size-4" /> Upload CSV
            <input
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => loadFile(e.target.files?.[0])}
            />
          </label>
        </div>
        {fileName && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span className="font-medium">{fileName}</span>
            <span className="text-muted-foreground">
              · {rows.length.toLocaleString()} rows · {columns.length} columns
            </span>
            <button
              className="ml-auto text-xs text-muted-foreground underline"
              onClick={() => {
                setRows([]);
                setFileName("");
                setResult(null);
                setError("");
              }}
            >
              Clear dataset
            </button>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}
        {!rows.length && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm text-amber-100/90">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Excel tip: open the source workbook, select the respondent-level
              sheet, then use <strong>Save As → CSV UTF-8</strong>. If the
              workbook only contains summary totals, these algorithms cannot
              infer individual responses from those totals.
            </span>
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => {
                setModule(m.id);
                setResult(null);
                setRunError("");
              }}
              className={`glass-panel rounded-2xl border p-4 text-left transition-all ${module === m.id ? "border-primary/60 bg-primary/10 shadow-[0_0_24px_rgba(45,212,191,0.1)]" : "border-white/10 hover:border-white/20"}`}
            >
              <div className="flex items-center justify-between">
                <Icon className="size-4 text-primary" />
                {module === m.id && (
                  <span className="size-2 rounded-full bg-primary" />
                )}
              </div>
              <p className="mt-3 text-sm font-semibold">{m.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {m.desc}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className={panel}>
          <p className="text-xs uppercase tracking-[0.16em] text-primary">
            Analysis setup
          </p>
          <h3 className="mt-1 text-xl font-semibold">{activeModule.label}</h3>
          {!rows.length ? (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-sm font-medium">Waiting for a dataset</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Upload your CSV to enable the algorithms. The existing dashboard
                summary remains untouched, and no synthetic results are
                generated.
              </p>
            </div>
          ) : (
            <>
              {module === "quality" && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Stat
                      label="Rows"
                      value={quality!.rowCount}
                      detail="Uploaded records"
                    />
                    <Stat
                      label="Columns"
                      value={quality!.columnCount}
                      detail="Available attributes"
                    />
                    <Stat
                      label="Duplicate rows"
                      value={quality!.duplicateRows}
                      detail="Exact duplicates across columns"
                    />
                    <Stat
                      label="Missing cells"
                      value={Object.values(quality!.missing).reduce<number>(
                        (a, b) => a + Number(b),
                        0,
                      )}
                      detail="Blank values across all columns"
                    />
                  </div>
                  <button
                    className={button}
                    onClick={() => run(() => dataQuality(rows, columns))}
                  >
                    <Play className="size-4" /> Run quality audit
                  </button>
                </div>
              )}
              {module === "association" && (
                <div className="mt-5 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Each non-empty attribute becomes an item such as{" "}
                    <code>Platform=Amazon</code>. Select the attributes to
                    include.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {columns.map((c) => (
                      <label
                        key={c}
                        className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(c)}
                          onChange={(e) =>
                            setSelectedColumns((old) =>
                              e.target.checked
                                ? [...old, c]
                                : old.filter((x) => x !== c),
                            )
                          }
                        />
                        <span className="truncate">{c}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="text-xs text-muted-foreground">
                      Min support
                      <input
                        className={field}
                        type="number"
                        min="0.01"
                        max="1"
                        step="0.01"
                        value={minSupport}
                        onChange={(e) => setMinSupport(e.target.value)}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Min confidence
                      <input
                        className={field}
                        type="number"
                        min="0.01"
                        max="1"
                        step="0.05"
                        value={minConfidence}
                        onChange={(e) => setMinConfidence(e.target.value)}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Min lift
                      <input
                        className={field}
                        type="number"
                        min="0"
                        step="0.1"
                        value={minLift}
                        onChange={(e) => setMinLift(e.target.value)}
                      />
                    </label>
                  </div>
                  <button
                    className={button}
                    onClick={() =>
                      run(() =>
                        apriori(
                          rows,
                          selectedColumns,
                          Number(minSupport),
                          Number(minConfidence),
                          Number(minLift),
                          2,
                        ),
                      )
                    }
                    disabled={!selectedColumns.length}
                  >
                    <Play className="size-4" /> Run Apriori
                  </button>
                </div>
              )}
              {module === "segmentation" && (
                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Categorical k-modes groups records by the number of
                    mismatched attribute values. It does not treat category
                    labels as numeric measurements.
                  </p>
                  <label className="block text-sm text-muted-foreground">
                    Features to cluster
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {columns.map((c) => (
                        <label
                          key={c}
                          className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={selectedColumns.includes(c)}
                            onChange={(e) =>
                              setSelectedColumns((old) =>
                                e.target.checked
                                  ? [...old, c]
                                  : old.filter((x) => x !== c),
                              )
                            }
                          />
                          <span className="truncate">{c}</span>
                        </label>
                      ))}
                    </div>
                  </label>
                  <label className="block text-sm text-muted-foreground">
                    Number of clusters
                    <input
                      className={field}
                      type="number"
                      min="2"
                      max="10"
                      value={clusterCount}
                      onChange={(e) => setClusterCount(e.target.value)}
                    />
                  </label>
                  <button
                    className={button}
                    onClick={() =>
                      run(() =>
                        kModes(rows, selectedColumns, Number(clusterCount)),
                      )
                    }
                    disabled={!selectedColumns.length}
                  >
                    <Play className="size-4" /> Run k-modes
                  </button>
                </div>
              )}
              {module === "relationship" && (
                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Tests association between two categorical attributes using a
                    contingency table, Pearson chi-square statistic, and
                    bias-corrected Cramér’s V effect size.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-muted-foreground">
                      Attribute A
                      <select
                        className={field}
                        value={attributeA}
                        onChange={(e) => setAttributeA(e.target.value)}
                      >
                        {columns.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-muted-foreground">
                      Attribute B
                      <select
                        className={field}
                        value={attributeB}
                        onChange={(e) => setAttributeB(e.target.value)}
                      >
                        {columns.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    className={button}
                    onClick={() =>
                      run(() =>
                        categoricalAssociation(rows, attributeA, attributeB),
                      )
                    }
                    disabled={
                      !attributeA || !attributeB || attributeA === attributeB
                    }
                  >
                    <Play className="size-4" /> Analyze relationship
                  </button>
                </div>
              )}
              {module === "prediction" && (
                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Train/test evaluation of a small, interpretable categorical
                    decision tree (information gain). Treat scores as
                    exploratory, especially with small samples or rare classes.
                  </p>
                  <label className="block text-sm text-muted-foreground">
                    Target to predict
                    <select
                      className={field}
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      {columns.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-muted-foreground">
                    Predictor features
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {columns
                        .filter((c) => c !== target)
                        .map((c) => (
                          <label
                            key={c}
                            className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedColumns.includes(c)}
                              onChange={(e) =>
                                setSelectedColumns((old) =>
                                  e.target.checked
                                    ? [...old, c]
                                    : old.filter((x) => x !== c),
                                )
                              }
                            />
                            <span className="truncate">{c}</span>
                          </label>
                        ))}
                    </div>
                  </label>
                  <button
                    className={button}
                    onClick={() =>
                      run(() =>
                        decisionTreeEvaluation(
                          rows,
                          selectedColumns.filter((c) => c !== target),
                          target,
                        ),
                      )
                    }
                    disabled={
                      !target || !selectedColumns.some((c) => c !== target)
                    }
                  >
                    <Play className="size-4" /> Train and evaluate
                  </button>
                </div>
              )}
              {module === "olap" && (
                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-6 text-muted-foreground">
                    Slice and roll up uploaded records by any dimension. An
                    optional numeric measure reports its mean per group; row
                    counts are always shown.
                  </p>
                  <label className="block text-sm text-muted-foreground">
                    Group by dimension
                    <select
                      className={field}
                      value={dimension}
                      onChange={(e) => setDimension(e.target.value)}
                    >
                      {columns.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm text-muted-foreground">
                    Optional numeric measure
                    <select
                      className={field}
                      value={measure}
                      onChange={(e) => setMeasure(e.target.value)}
                    >
                      <option value="">No measure — counts only</option>
                      {numericColumns.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={button}
                    onClick={() =>
                      run(() => olap(rows, dimension, measure || undefined))
                    }
                  >
                    <Play className="size-4" /> Run OLAP roll-up
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className={panel}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-primary">
                Computed output
              </p>
              <h3 className="mt-1 text-xl font-semibold">Results</h3>
            </div>
            {result && (
              <button
                className={mutedButton}
                onClick={() =>
                  downloadCSV(
                    `campus-commerce-${module}-results.csv`,
                    toExportRows(module, result),
                  )
                }
              >
                Export CSV
              </button>
            )}
          </div>
          {runError && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200"
            >
              {runError}
            </p>
          )}
          {!result && !runError && (
            <div className="mt-5 flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 p-6 text-center">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <BarChart3 className="size-5" />
              </div>
              <p className="mt-3 text-sm font-medium">
                Your results will appear here
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                Choose a module, configure the parameters, and run the analysis
                to calculate results from your uploaded data.
              </p>
            </div>
          )}
          {result && (
            <div className="mt-5 space-y-4">
              {module === "quality" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Column</th>
                        <th className="py-2 pr-3">Missing</th>
                        <th className="py-2">Unique values</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((c) => (
                        <tr key={c} className="border-b border-white/5">
                          <td className="py-2 pr-3">{c}</td>
                          <td className="py-2 pr-3">{quality?.missing[c]}</td>
                          <td className="py-2">{quality?.unique[c]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {module === "association" && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat
                      label="Rules found"
                      value={result.length}
                      detail="After thresholds"
                    />
                    <Stat
                      label="Min support"
                      value={minSupport}
                      detail="Share of rows"
                    />
                    <Stat
                      label="Min confidence"
                      value={minConfidence}
                      detail="Conditional share"
                    />
                  </div>
                  {result.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-xs text-muted-foreground">
                            <th className="py-2 pr-3">Rule</th>
                            <th className="py-2 pr-3">Support</th>
                            <th className="py-2 pr-3">Confidence</th>
                            <th className="py-2">Lift</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.map((r: any, i: number) => (
                            <tr
                              key={i}
                              className="border-b border-white/5 align-top"
                            >
                              <td className="max-w-64 py-3 pr-3">
                                <span>{r.antecedent.join(" + ")}</span>
                                <span className="mx-2 text-primary">→</span>
                                <span>{r.consequent.join(" + ")}</span>
                              </td>
                              <td className="py-3 pr-3">
                                {(r.support * 100).toFixed(1)}%
                              </td>
                              <td className="py-3 pr-3">
                                {(r.confidence * 100).toFixed(1)}%
                              </td>
                              <td className="py-3">{r.lift.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No rules met these thresholds. Lower minimum
                      support/confidence or select fewer attributes.
                    </p>
                  )}
                  <p className="text-xs leading-5 text-muted-foreground">
                    Rules describe co-occurrence in this sample, not causation.
                    Attributes with many unique values can create sparse,
                    unhelpful rules.
                  </p>
                </>
              )}
              {module === "segmentation" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat
                      label="Clusters"
                      value={result.clusters.length}
                      detail="k-modes"
                    />
                    <Stat
                      label="Within-cluster mismatch cost"
                      value={result.cost}
                      detail="Lower is tighter for same features"
                    />
                  </div>
                  {result.clusters.map((c: any) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-white/10 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Cluster {c.id}</p>
                        <span className="text-sm text-primary">
                          {c.size} rows
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(c.centroid).map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-lg bg-white/5 px-2 py-1 text-xs"
                          >
                            <span className="text-muted-foreground">
                              {key}:{" "}
                            </span>
                            {String(value)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {module === "relationship" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat
                      label="Complete pairs"
                      value={result.n}
                      detail="Rows used"
                    />
                    <Stat
                      label="Cramér’s V"
                      value={result.cramersV.toFixed(3)}
                      detail="Bias-corrected effect size"
                    />
                    <Stat
                      label="Chi-square"
                      value={result.chiSquare.toFixed(3)}
                      detail="Pearson statistic"
                    />
                    <Stat
                      label="Minimum expected cell"
                      value={result.minExpected.toFixed(2)}
                      detail="Assumption diagnostic"
                    />
                  </div>
                  <p className="rounded-xl bg-white/[0.04] p-3 text-sm text-muted-foreground">
                    {result.note} P-value calculation is not included in this
                    browser-only build; chi-square statistic and effect size are
                    reported without claiming statistical significance.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th className="p-2">
                            {result.a} \ {result.b}
                          </th>
                          {result.bValues.map((v: string) => (
                            <th key={v} className="p-2">
                              {v}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.aValues.map((v: string, i: number) => (
                          <tr key={v} className="border-t border-white/10">
                            <td className="p-2 font-medium">{v}</td>
                            {result.table[i].map((n: number, j: number) => (
                              <td key={j} className="p-2">
                                {n}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {module === "prediction" && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat
                      label="Accuracy"
                      value={`${(result.accuracy * 100).toFixed(1)}%`}
                      detail="Held-out test rows"
                    />
                    <Stat
                      label="Training rows"
                      value={result.trainRows}
                      detail="Tree fit"
                    />
                    <Stat
                      label="Test rows"
                      value={result.testRows}
                      detail="Unseen during fit"
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-xs text-muted-foreground">
                          <th className="py-2 pr-3">Class</th>
                          <th className="py-2 pr-3">Precision</th>
                          <th className="py-2 pr-3">Recall</th>
                          <th className="py-2">F1</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.metrics.map((m: any) => (
                          <tr key={m.label} className="border-b border-white/5">
                            <td className="py-2 pr-3">{m.label}</td>
                            <td className="py-2 pr-3">
                              {m.precision.toFixed(2)}
                            </td>
                            <td className="py-2 pr-3">{m.recall.toFixed(2)}</td>
                            <td className="py-2">{m.f1.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    This is a single deterministic holdout split, not
                    cross-validation. With small survey samples, scores can vary
                    substantially between splits. Do not treat the model as a
                    validated real-world predictor.
                  </p>
                </>
              )}
              {module === "olap" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Group</th>
                        <th className="py-2 pr-3">Rows</th>
                        {measure && <th className="py-2">Mean {measure}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {result.map((r: any) => (
                        <tr key={r.label} className="border-b border-white/5">
                          <td className="py-2 pr-3">{r.label}</td>
                          <td className="py-2 pr-3">{r.count}</td>
                          {measure && (
                            <td className="py-2">
                              {r.mean === null ? "—" : r.mean.toFixed(2)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function toExportRows(module: string, result: any): Record<string, unknown>[] {
  if (module === "association")
    return result.map((r: any) => ({
      antecedent: r.antecedent.join(" + "),
      consequent: r.consequent.join(" + "),
      support: r.support,
      confidence: r.confidence,
      lift: r.lift,
    }));
  if (module === "segmentation")
    return result.clusters.map((c: any) => ({
      cluster: c.id,
      size: c.size,
      ...c.centroid,
    }));
  if (module === "relationship")
    return result.aValues.flatMap((v: string, i: number) =>
      result.bValues.map((b: string, j: number) => ({
        [result.a]: v,
        [result.b]: b,
        count: result.table[i][j],
      })),
    );
  if (module === "prediction") return result.predictions;
  return Array.isArray(result)
    ? result
    : Object.entries(result).map(([key, value]) => ({
        key,
        value: typeof value === "object" ? JSON.stringify(value) : value,
      }));
}
