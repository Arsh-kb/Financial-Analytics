Campus Commerce DMA patch
Files
- components/cards/financial-analytics-dashboard.tsx — existing dashboard preserved; adds the Data Mining Lab navigation route.
- components/cards/data-mining-lab.tsx — functional CSV-upload-based DMA interface.
- lib/dma.ts — pure TypeScript algorithms and data helpers.
- dma-tests.js — smoke tests for the helper algorithms.
Apply
Copy these folders/files into the root of your existing Next.js project, preserving the paths. The existing project uses the @/ alias for the project root.
Dataset
The lab currently accepts .csv files. Open the original workbook, select the sheet with one row per survey respondent, then save/export it as CSV UTF-8 and upload that file in the Data Mining Lab. Summary tables cannot support respondent-level association rules, clustering, or classification. The current dashboard's JSON summary remains unchanged.
Implemented modules
- Data quality: missing values, duplicate rows, per-column unique counts.
- Apriori association rules: support, confidence, lift; user-selectable attributes and thresholds.
- Categorical k-modes clustering.
- Categorical relationship analysis: contingency table, Pearson chi-square statistic, bias-corrected Cramér's V and expected-count diagnostic. P-values are intentionally not reported in this browser-only implementation.
- Categorical decision tree: deterministic holdout split, accuracy, precision, recall, F1 and confusion matrix.
- OLAP-style grouping / roll-up: group counts and optional numeric means.
- CSV export for computed results.
Smoke tests
With TypeScript installed globally:
tsc --target ES2020 --module commonjs --outDir .test-build --skipLibCheck lib/dma.ts
node dma-tests.js
The smoke tests passed in the authoring environment. A full Next.js build was not run because the complete project, package manifest, and installed project dependencies were not part of the uploaded files available for this patch.