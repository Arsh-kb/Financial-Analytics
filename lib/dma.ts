export type Row = Record<string, string>;
export type Rule = {
  antecedent: string[];
  consequent: string[];
  support: number;
  confidence: number;
  lift: number;
};

export function parseCSV(text: string): Row[] {
  const records: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((v) => v !== "")) records.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((v) => v !== "")) records.push(row);
  if (records.length < 2)
    throw new Error("The CSV must contain a header and at least one data row.");
  const headers = records[0].map((h, i) => h || `column_${i + 1}`);
  return records
    .slice(1)
    .map((values) =>
      Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()])),
    );
}

export function dataQuality(rows: Row[], columns: string[]) {
  const missing: Record<string, number> = {};
  const unique: Record<string, number> = {};
  columns.forEach((c) => {
    missing[c] = rows.filter((r) => !r[c]?.trim()).length;
    unique[c] = new Set(rows.map((r) => r[c]).filter((v) => v?.trim())).size;
  });
  const signatures = rows.map((r) =>
    columns.map((c) => r[c] ?? "").join("\u001f"),
  );
  return {
    rowCount: rows.length,
    columnCount: columns.length,
    duplicateRows: signatures.length - new Set(signatures).size,
    missing,
    unique,
  };
}

const itemKey = (items: string[]) => [...items].sort().join(" | ");
export function apriori(
  rows: Row[],
  columns: string[],
  minSupport = 0.1,
  minConfidence = 0.5,
  minLift = 1,
  maxAntecedent = 2,
): Rule[] {
  if (!rows.length || !columns.length) return [];
  const transactions = rows.map((r) =>
    columns.filter((c) => r[c]?.trim()).map((c) => `${c}=${r[c]}`),
  );
  const support = new Map<string, number>();
  let current = [...new Set(transactions.flatMap((t) => t))].map((x) => [x]);
  const maxSize = Math.min(5, maxAntecedent + 1);
  for (let size = 1; size <= maxSize && current.length; size++) {
    const frequent: string[][] = [];
    for (const candidate of current) {
      const count = transactions.filter((t) =>
        candidate.every((x) => t.includes(x)),
      ).length;
      const s = count / rows.length;
      support.set(itemKey(candidate), s);
      if (s >= minSupport) frequent.push(candidate);
    }
    if (size === maxSize) break;
    const next = new Map<string, string[]>();
    for (let i = 0; i < frequent.length; i++)
      for (let j = i + 1; j < frequent.length; j++) {
        const merged = [...new Set([...frequent[i], ...frequent[j]])].sort();
        if (
          merged.length === size + 1 &&
          merged.every((x) =>
            frequent.some(
              (f) => f.length === size && f.every((v) => merged.includes(v)),
            ),
          )
        )
          next.set(itemKey(merged), merged);
      }
    current = [...next.values()];
  }
  const rules: Rule[] = [];
  for (const [key, jointSupport] of support.entries()) {
    const all = key.split(" | ");
    if (all.length < 2 || jointSupport < minSupport) continue;
    const combinations = (
      arr: string[],
      k: number,
      start = 0,
      prefix: string[] = [],
    ): string[][] => {
      if (prefix.length === k) return [prefix];
      const out: string[][] = [];
      for (let i = start; i < arr.length; i++)
        out.push(...combinations(arr, k, i + 1, [...prefix, arr[i]]));
      return out;
    };
    for (let k = 1; k <= Math.min(maxAntecedent, all.length - 1); k++)
      for (const antecedent of combinations(all, k)) {
        const consequent = all.filter((x) => !antecedent.includes(x));
        const aSupport = support.get(itemKey(antecedent));
        const cSupport = support.get(itemKey(consequent));
        if (!aSupport || !cSupport) continue;
        const confidence = jointSupport / aSupport;
        const lift = confidence / cSupport;
        if (confidence >= minConfidence && lift >= minLift)
          rules.push({
            antecedent,
            consequent,
            support: jointSupport,
            confidence,
            lift,
          });
      }
  }
  return rules
    .sort((a, b) => b.lift - a.lift || b.confidence - a.confidence)
    .slice(0, 100);
}

export function kModes(
  rows: Row[],
  columns: string[],
  k = 3,
  maxIterations = 30,
) {
  if (rows.length < k || !columns.length)
    throw new Error(
      "Choose at least one feature and no more clusters than rows.",
    );
  const values = rows.map((r) => columns.map((c) => r[c] || "(missing)"));
  const centroids = Array.from({ length: k }, (_, i) => [
    ...values[Math.floor((i * values.length) / k)],
  ]);
  let assignments = new Array(rows.length).fill(-1);
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const next = values.map((v) => {
      let best = 0,
        bestDistance = Infinity;
      centroids.forEach((centroid, ci) => {
        const distance = v.reduce(
          (sum, x, j) => sum + (x === centroid[j] ? 0 : 1),
          0,
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          best = ci;
        }
      });
      return best;
    });
    const unchanged = next.every((v, i) => v === assignments[i]);
    assignments = next;
    for (let ci = 0; ci < k; ci++) {
      const members = values.filter((_, i) => assignments[i] === ci);
      if (!members.length) continue;
      centroids[ci] = columns.map((_, j) => {
        const counts = new Map<string, number>();
        members.forEach((m) => counts.set(m[j], (counts.get(m[j]) ?? 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      });
    }
    if (unchanged) break;
  }
  return {
    assignments,
    clusters: centroids.map((centroid, ci) => ({
      id: ci + 1,
      size: assignments.filter((a) => a === ci).length,
      centroid: Object.fromEntries(columns.map((c, j) => [c, centroid[j]])),
    })),
    cost: values.reduce(
      (sum, v, i) =>
        sum +
        v.reduce(
          (d, x, j) => d + (x === centroids[assignments[i]][j] ? 0 : 1),
          0,
        ),
      0,
    ),
  };
}

export function categoricalAssociation(rows: Row[], a: string, b: string) {
  const valid = rows.filter((r) => r[a]?.trim() && r[b]?.trim());
  const av = [...new Set(valid.map((r) => r[a]))],
    bv = [...new Set(valid.map((r) => r[b]))];
  const table = av.map((x) =>
    bv.map((y) => valid.filter((r) => r[a] === x && r[b] === y).length),
  );
  const rowTotals = table.map((r) => r.reduce((s, n) => s + n, 0));
  const colTotals = bv.map((_, j) => table.reduce((s, r) => s + r[j], 0));
  let chiSquare = 0;
  table.forEach((r, i) =>
    r.forEach((observed, j) => {
      const expected = (rowTotals[i] * colTotals[j]) / valid.length;
      if (expected > 0) chiSquare += (observed - expected) ** 2 / expected;
    }),
  );
  const phi2 = chiSquare / Math.max(1, valid.length);
  const biasCorrectedPhi2 = Math.max(
    0,
    phi2 - ((av.length - 1) * (bv.length - 1)) / Math.max(1, valid.length - 1),
  );
  const r = av.length,
    c = bv.length,
    n = valid.length;
  const correctedR = r - (r - 1) ** 2 / Math.max(1, n - 1),
    correctedC = c - (c - 1) ** 2 / Math.max(1, n - 1);
  const denom = Math.min(correctedR - 1, correctedC - 1);
  const cramersV = denom > 0 ? Math.sqrt(biasCorrectedPhi2 / denom) : 0;
  const minExpected = Math.min(
    ...rowTotals.flatMap((rt) =>
      colTotals.map((ct) => (rt * ct) / Math.max(1, n)),
    ),
  );
  return {
    n,
    a,
    b,
    aValues: av,
    bValues: bv,
    table,
    chiSquare,
    cramersV,
    minExpected,
    note:
      minExpected < 5
        ? "Some expected cell counts are below 5; interpret the chi-square approximation cautiously."
        : "Expected cell counts meet the common minimum-of-5 guideline.",
  };
}

export function decisionTreeEvaluation(
  rows: Row[],
  features: string[],
  target: string,
  testFraction = 0.25,
) {
  const usable = rows.filter((r) => r[target]?.trim());
  const classes = [...new Set(usable.map((r) => r[target]))];
  if (usable.length < 8 || classes.length < 2)
    throw new Error(
      "Need at least 8 complete rows and at least 2 target classes.",
    );
  const shuffled = [...usable]
    .map((r, i) => ({ r, sort: ((i * 9301 + 49297) % 233280) / 233280 }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.r);
  const split = Math.max(
    2,
    Math.min(
      shuffled.length - 1,
      Math.floor(shuffled.length * (1 - testFraction)),
    ),
  );
  const train = shuffled.slice(0, split),
    test = shuffled.slice(split);
  type Node = {
    prediction: string;
    feature?: string;
    branches?: Record<string, Node>;
  };
  const majority = (subset: Row[]) =>
    [...new Set(subset.map((r) => r[target]))]
      .map((c) => [c, subset.filter((r) => r[target] === c).length] as const)
      .sort((a, b) => b[1] - a[1])[0][0];
  const entropy = (subset: Row[]) => {
    const n = subset.length;
    return [...new Set(subset.map((r) => r[target]))].reduce((sum, c) => {
      const p = subset.filter((r) => r[target] === c).length / n;
      return p ? sum - p * Math.log2(p) : sum;
    }, 0);
  };
  const build = (subset: Row[], available: string[], depth = 0): Node => {
    const pred = majority(subset);
    if (
      depth >= 5 ||
      subset.length < 4 ||
      new Set(subset.map((r) => r[target])).size < 2 ||
      !available.length
    )
      return { prediction: pred };
    let best = "",
      bestGain = 0;
    for (const f of available) {
      const vals = [...new Set(subset.map((r) => r[f] || "(missing)"))];
      if (vals.length < 2 || vals.length > 20) continue;
      const remainder = vals.reduce((sum, v) => {
        const group = subset.filter((r) => (r[f] || "(missing)") === v);
        return sum + (group.length / subset.length) * entropy(group);
      }, 0);
      const gain = entropy(subset) - remainder;
      if (gain > bestGain) {
        bestGain = gain;
        best = f;
      }
    }
    if (!best) return { prediction: pred };
    const branches: Record<string, Node> = {};
    for (const v of [...new Set(subset.map((r) => r[best] || "(missing)"))])
      branches[v] = build(
        subset.filter((r) => (r[best] || "(missing)") === v),
        available.filter((f) => f !== best),
        depth + 1,
      );
    return { prediction: pred, feature: best, branches };
  };
  const tree = build(
    train,
    features.filter((f) => f !== target),
  );
  const predict = (row: Row, node: Node): string =>
    node.feature && node.branches
      ? predict(
          row,
          node.branches[row[node.feature] || "(missing)"] ?? {
            prediction: node.prediction,
          },
        )
      : node.prediction;
  const predictions = test.map((r) => ({
    actual: r[target],
    predicted: predict(r, tree),
  }));
  const accuracy =
    predictions.filter((p) => p.actual === p.predicted).length /
    predictions.length;
  const confusion = classes.map((c) => ({
    label: c,
    values: classes.map(
      (p) =>
        predictions.filter((x) => x.actual === c && x.predicted === p).length,
    ),
  }));
  const metrics = classes.map((c) => {
    const tp = predictions.filter(
      (p) => p.actual === c && p.predicted === c,
    ).length;
    const fp = predictions.filter(
      (p) => p.actual !== c && p.predicted === c,
    ).length;
    const fn = predictions.filter(
      (p) => p.actual === c && p.predicted !== c,
    ).length;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return {
      label: c,
      precision,
      recall,
      f1:
        precision + recall
          ? (2 * precision * recall) / (precision + recall)
          : 0,
    };
  });
  return {
    trainRows: train.length,
    testRows: test.length,
    accuracy,
    classes,
    confusion,
    metrics,
    predictions,
    tree,
  };
}

export function olap(rows: Row[], dimension: string, measure?: string) {
  const groups = new Map<
    string,
    { count: number; sum: number; numericCount: number }
  >();
  for (const row of rows) {
    const key = row[dimension]?.trim() || "(missing)";
    const current = groups.get(key) ?? { count: 0, sum: 0, numericCount: 0 };
    current.count++;
    if (measure) {
      const value = Number(row[measure]);
      if (row[measure]?.trim() && Number.isFinite(value)) {
        current.sum += value;
        current.numericCount++;
      }
    }
    groups.set(key, current);
  }
  return [...groups.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      mean: v.numericCount ? v.sum / v.numericCount : null,
    }))
    .sort((a, b) => b.count - a.count);
}
