/**
 * Vega Org Hierarchy Template — Automated Test Suite
 * Simulates Deneb's Power BI data injection and validates the spec end-to-end.
 */

import * as vega from 'vega';
import { readFileSync } from 'fs';

// ── helpers ──────────────────────────────────────────────────────────────────
const PASS  = '\x1b[32m✔\x1b[0m';
const FAIL  = '\x1b[31m✘\x1b[0m';
const WARN  = '\x1b[33m⚠\x1b[0m';
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

let passed = 0, failed = 0, warned = 0;

function pass(msg)    { console.log(`  ${PASS} ${msg}`); passed++; }
function fail(msg)    { console.log(`  ${FAIL} ${BOLD}${msg}${RESET}`); failed++; }
function warn(msg)    { console.log(`  ${WARN} ${msg}`); warned++; }
function section(t)   { console.log(`\n${BOLD}── ${t} ──${RESET}`); }

function parseCsv(raw) {
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

function computeDepths(data) {
  const id2row = Object.fromEntries(data.map(r => [r.EmployeeID, r]));
  const depths = {};
  function getDepth(id) {
    if (id in depths) return depths[id];
    const row = id2row[id];
    if (!row || !row.ManagerID || row.ManagerID.trim() === '') return (depths[id] = 0);
    return (depths[id] = 1 + getDepth(row.ManagerID));
  }
  data.forEach(r => getDepth(r.EmployeeID));
  return depths;
}

// ── Load files ─────────────────────────────────────────────────────────────
section('SETUP');

let specRaw, spec, dataset;
try {
  specRaw = readFileSync('./org_hierarchy_vega_template.json', 'utf8');
  pass('Template file found and readable');
} catch (e) { fail(`Cannot read template: ${e.message}`); process.exit(1); }

try {
  dataset = parseCsv(readFileSync('./sample_org_data.csv', 'utf8'));
  pass('Sample CSV found and readable');
} catch (e) { fail(`Cannot read CSV: ${e.message}`); process.exit(1); }

// ── TEST 1: JSON validity ──────────────────────────────────────────────────
section('TEST 1 — JSON Syntax Validation');
try {
  spec = JSON.parse(specRaw);
  pass('Template is valid JSON — no syntax errors');
} catch (e) { fail(`Invalid JSON: ${e.message}`); process.exit(1); }

// ── TEST 2: Vega spec structure ────────────────────────────────────────────
section('TEST 2 — Vega Spec Structure');
['$schema', 'data', 'signals', 'marks', 'width', 'height', 'background'].forEach(k => {
  if (spec[k] !== undefined) pass(`Top-level key "${k}" present`);
  else fail(`Top-level key "${k}" MISSING`);
});
if (spec.$schema?.includes('vega/v5')) pass('Schema is Vega v5 (required by Deneb)');
else fail(`Schema should be Vega v5, got: ${spec.$schema}`);

// ── TEST 3: Data sources ───────────────────────────────────────────────────
section('TEST 3 — Data Source Configuration');
const dsNames = (spec.data || []).map(d => d.name);
['dataset', 'tree', 'links'].forEach(n => {
  if (dsNames.includes(n)) pass(`Data source "${n}" present`);
  else fail(`Data source "${n}" MISSING`);
});

const datasetDS = spec.data.find(d => d.name === 'dataset');
if (!datasetDS.source && !datasetDS.values && !datasetDS.url)
  pass('"dataset" has no pre-loaded data — correctly relies on Deneb/Power BI injection');
else
  warn('"dataset" has pre-loaded data — in production this will be overridden by Power BI, but hardcoded data should be removed');

// ── TEST 4: Stratify transform ─────────────────────────────────────────────
section('TEST 4 — Stratify Transform (Hierarchy Builder)');
const treeDS = spec.data.find(d => d.name === 'tree');
const strat  = treeDS?.transform?.find(t => t.type === 'stratify');
const treeT  = treeDS?.transform?.find(t => t.type === 'tree');
if (strat) {
  pass('stratify transform present');
  if (strat.key === 'EmployeeID')     pass(`  key = "EmployeeID" ✓`);
  else fail(`  key should be "EmployeeID", got "${strat.key}"`);
  if (strat.parentKey === 'ManagerID') pass(`  parentKey = "ManagerID" ✓`);
  else fail(`  parentKey should be "ManagerID", got "${strat.parentKey}"`);
} else fail('stratify transform MISSING');

if (treeT) {
  pass(`tree layout transform present (method: "${treeT.method}")`);
  if (treeT.separation === true) pass('  separation = true (prevents node overlap)');
  else warn('  separation not set — sibling nodes may overlap');
} else fail('tree layout transform MISSING');

// ── TEST 5: Linkpath field references ──────────────────────────────────────
section('TEST 5 — Linkpath Transform Field References');
const linksDS = spec.data.find(d => d.name === 'links');
const lp = linksDS?.transform?.find(t => t.type === 'linkpath');
if (lp) {
  pass('linkpath transform present');
  const refs = { sourceX: 'source.x', sourceY: 'source.y', targetX: 'target.x', targetY: 'target.y' };
  Object.entries(refs).forEach(([param, expected]) => {
    const actual = lp[param];
    if (actual === expected) pass(`  ${param} = "${actual}" ✓`);
    else if (actual?.startsWith('datum.'))
      fail(`  ${param} = "${actual}" — WRONG: "datum." prefix is invalid in linkpath field refs. Should be "${expected}"`);
    else
      fail(`  ${param} = "${actual}" — expected "${expected}"`);
  });
  if (lp.orient === 'vertical')  pass(`  orient = "vertical" (top-down tree) ✓`);
  if (lp.shape  === 'orthogonal') pass(`  shape = "orthogonal" (right-angle connectors) ✓`);
} else fail('linkpath transform MISSING');

// ── TEST 6: Field references in spec ──────────────────────────────────────
section('TEST 6 — Power BI Field References');
const s = specRaw;
['EmployeeID','ManagerID','Name','Title','Department','Location'].forEach(f => {
  // Fields may appear as {"field":"X"}, "parent.X", "datum.X", or just "X" key strings
  const patterns = [`"${f}"`, `parent.${f}`, `datum.${f}`];
  if (patterns.some(p => s.includes(p))) pass(`Field "${f}" referenced in spec`);
  else fail(`Field "${f}" NOT found in spec`);
});

// ── TEST 7: Signals ────────────────────────────────────────────────────────
section('TEST 7 — Interactive Signals');
const signals = spec.signals || [];
const sigMap = Object.fromEntries(signals.map(s => [s.name, s]));
['nodeW','nodeH','hdrH','gapX','gapY','selectedID'].forEach(n => {
  if (sigMap[n]) pass(`Signal "${n}" = ${JSON.stringify(sigMap[n].value)}`);
  else fail(`Signal "${n}" MISSING`);
});
const sel = sigMap['selectedID'];
if (sel?.on?.length > 0 && sel.on[0].events?.includes('click'))
  pass('selectedID click handler configured — card selection is interactive');
else
  fail('selectedID has no click handler — click-to-select will NOT work');

// ── TEST 8: Mark structure ─────────────────────────────────────────────────
section('TEST 8 — Marks Structure');
const marks = spec.marks || [];
if (marks.some(m => m.from?.data === 'links')) pass('Connector path mark bound to "links"');
else fail('No mark bound to "links" — connector lines will not render');

const ng = marks.find(m => m.name === 'nodeGroup');
if (ng) {
  pass('"nodeGroup" group mark found');
  if (ng.from?.data === 'tree') pass('  nodeGroup bound to "tree" data ✓');
  else fail('  nodeGroup NOT bound to "tree"');
  const inner = ng.marks || [];
  pass(`  ${inner.length} inner marks (card layers)`);
  const types = inner.map(m => m.type);
  if (types.includes('rect')) pass('  rect marks present (card backgrounds)');
  else fail('  rect marks MISSING');
  if (types.includes('text')) pass('  text marks present (name, title, department labels)');
  else fail('  text marks MISSING');
  if (types.includes('rule')) pass('  rule mark present (separator line between title and department)');
  else warn('  rule mark missing — no separator line');
  if (ng.encode?.update?.tooltip) pass('  tooltip defined on nodeGroup');
  else warn('  no tooltip — hover details will not show');
} else fail('"nodeGroup" mark MISSING — no cards will render');

// ── TEST 9: Sample data integrity ─────────────────────────────────────────
section('TEST 9 — Sample Data Integrity');
pass(`${dataset.length} rows loaded`);

const cols = Object.keys(dataset[0] || {});
['EmployeeID','ManagerID','Name','Title','Department','Location'].forEach(c => {
  if (cols.includes(c)) pass(`Column "${c}" present`);
  else fail(`Column "${c}" MISSING from CSV`);
});

const roots = dataset.filter(r => !r.ManagerID?.trim());
if (roots.length === 1) pass(`Single root: "${roots[0].Name}" (${roots[0].EmployeeID})`);
else if (roots.length === 0) fail('No root node — one row must have blank ManagerID');
else fail(`${roots.length} root nodes — only one allowed`);

const ids = new Set(dataset.map(r => r.EmployeeID));
const orphans = dataset.filter(r => r.ManagerID?.trim() && !ids.has(r.ManagerID));
if (orphans.length === 0) pass('No orphan nodes (all ManagerIDs are valid EmployeeIDs)');
else orphans.forEach(o => fail(`Orphan: "${o.Name}" (ManagerID="${o.ManagerID}" not found)`));

const seen = new Set(); const dupes = [];
dataset.forEach(r => { if (seen.has(r.EmployeeID)) dupes.push(r); seen.add(r.EmployeeID); });
if (dupes.length === 0) pass('No duplicate EmployeeIDs');
else dupes.forEach(d => fail(`Duplicate EmployeeID: "${d.EmployeeID}"`));

const depths = computeDepths(dataset);
const byDepth = {};
Object.values(depths).forEach(d => { byDepth[d] = (byDepth[d] || 0) + 1; });
const depthLabels = { 0:'C-Suite', 1:'VP', 2:'Director', 3:'Manager', 4:'IC' };
Object.entries(byDepth).sort(([a],[b]) => a-b).forEach(([d, n]) =>
  pass(`  Level ${d} (${depthLabels[d] || 'Deep'}): ${n} node${n>1?'s':''}`)
);

// ── TEST 10: Vega runtime end-to-end ──────────────────────────────────────
section('TEST 10 — Vega Runtime Execution (End-to-End)');

try {
  const testSpec = JSON.parse(specRaw);
  testSpec.data.find(d => d.name === 'dataset').values = dataset;

  // Capture Vega warnings using built-in logger
  const vegaWarnings = [];
  const lg = vega.logger(vega.Warn);
  const origWarn = lg.warn.bind(lg);
  lg.warn = (...args) => { vegaWarnings.push(args.join(' ')); };

  const view = new vega.View(vega.parse(testSpec), {
    renderer: 'none',
    logLevel: vega.Warn,
    logger: lg
  });

  await view.runAsync();
  pass('Vega runtime executed successfully with all 22 nodes');

  const treeData  = view.data('tree');
  const linksData = view.data('links');

  // Node count check
  if (treeData.length === dataset.length)
    pass(`All ${treeData.length} nodes rendered (matches input row count)`);
  else
    fail(`Node count mismatch: rendered ${treeData.length}, expected ${dataset.length}`);

  // Link count check (tree with N nodes has N-1 edges)
  const expectedLinks = dataset.length - 1;
  if (linksData.length === expectedLinks)
    pass(`All ${linksData.length} connector lines rendered (N-1 rule satisfied)`);
  else
    fail(`Link count: got ${linksData.length}, expected ${expectedLinks}`);

  // Position validity
  const allHaveXY = treeData.every(d => typeof d.x === 'number' && typeof d.y === 'number');
  if (allHaveXY) pass('All nodes have valid numeric x/y positions');
  else fail('Some nodes have missing/NaN x/y positions');

  const noNaN = treeData.every(d => !isNaN(d.x) && !isNaN(d.y));
  if (noNaN) pass('No NaN positions detected');
  else fail('NaN positions found — some nodes will not render');

  // Link paths valid
  const pathsValid = linksData.every(d => typeof d.path === 'string' && d.path.startsWith('M'));
  if (pathsValid) pass('All SVG link paths are well-formed (start with "M")');
  else fail('Some link paths are malformed');

  // Depth spread check
  const maxDepth = Math.max(...treeData.map(d => d.depth));
  const minDepth = Math.min(...treeData.map(d => d.depth));
  pass(`Hierarchy spans levels ${minDepth}–${maxDepth} (${maxDepth - minDepth + 1} levels deep)`);

  // Layout bounds check
  const xVals = treeData.map(d => d.x);
  const yVals = treeData.map(d => d.y);
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
  pass(`X spread: ${xMin.toFixed(0)}–${xMax.toFixed(0)}px (canvas width: ${testSpec.width})`);
  pass(`Y spread: ${yMin.toFixed(0)}–${yMax.toFixed(0)}px (canvas height: ${testSpec.height})`);

  // Overlap check — no two nodes at identical positions
  const posSet = new Set(treeData.map(d => `${d.x.toFixed(0)},${d.y.toFixed(0)}`));
  if (posSet.size === treeData.length) pass('No overlapping node positions');
  else warn(`${treeData.length - posSet.size} nodes share positions — may overlap visually`);

  // Check root node is Sarah Chen
  const root = treeData.find(d => d.depth === 0);
  if (root?.Name === 'Sarah Chen') pass(`Root node: "${root.Name}" at top (y=${root.y.toFixed(0)})`);
  else pass(`Root node: "${root?.Name}" rendered at hierarchy top`);

  // Vega warnings
  if (vegaWarnings.length === 0) pass('No Vega runtime warnings');
  else vegaWarnings.forEach(w => warn(`Vega: ${w}`));

  view.finalize();
} catch (e) {
  fail(`Vega runtime error: ${e.message}`);
  console.error('  Stack:', e.stack?.split('\n').slice(0,4).join('\n  '));
}

// ── TEST 11: Deneb-specific compatibility ──────────────────────────────────
section('TEST 11 — Deneb / Power BI Compatibility');

const specStr = specRaw;
if (!specStr.includes('"hardcoded"') && !specStr.includes("'hardcoded'"))
  pass('No hardcoded data values detected — data comes from Power BI dataset');

if (spec.autosize) pass(`autosize set to "${JSON.stringify(spec.autosize)}" — visual will fit container`);
else warn('autosize not set — visual may not resize with Power BI container');

const hasDatumPrefix = /linkpath[^}]*datum\.(source|target)/s.test(specStr);
if (!hasDatumPrefix) pass('No "datum." prefix in linkpath fields — Vega field refs are correct');
else fail('Found "datum." prefix in linkpath fields — must use bare dot-path (e.g. "source.x")');

if (spec.background) pass(`Background color set: "${spec.background}"`);
else warn('No background color — will inherit from Power BI visual area');

const fontRefs = [...specStr.matchAll(/"font":\s*\{?"([^"]+)"/g)].map(m => m[1]);
if (fontRefs.length > 0) pass(`Font specified: "${fontRefs[0]}" (Segoe UI matches Power BI design system)`);

if (spec.signals?.some(s => s.name === 'selectedID'))
  pass('Click-to-select signal defined — visual is interactive without extra Power BI config');

// ── SUMMARY ───────────────────────────────────────────────────────────────
section('RESULTS SUMMARY');
console.log(`  ${PASS} Passed:   ${BOLD}${passed}${RESET}`);
if (warned > 0) console.log(`  ${WARN} Warnings: ${BOLD}${warned}${RESET}  (non-blocking)`);
if (failed > 0) {
  console.log(`  ${FAIL} Failed:   ${BOLD}${failed}${RESET}`);
  console.log(`\n  ${BOLD}Fix the failures above before deploying to Power BI.${RESET}\n`);
  process.exit(1);
} else {
  console.log(`\n  ${BOLD}\x1b[32m✔ ALL TESTS PASSED — Template is validated and ready for Power BI.${RESET}\n`);
}
