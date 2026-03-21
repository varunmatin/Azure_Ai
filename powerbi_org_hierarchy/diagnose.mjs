/**
 * Diagnostic script — runs Vega spec with verbose error capture
 * to identify the exact runtime failure point.
 */
import * as vega from 'vega';
import { readFileSync } from 'fs';

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

const specRaw = readFileSync('./org_hierarchy_vega_template.json', 'utf8');
const dataset = parseCsv(readFileSync('./sample_org_data.csv', 'utf8'));
const spec = JSON.parse(specRaw);
spec.data.find(d => d.name === 'dataset').values = dataset;

// Use built-in Vega logger to capture warnings
const logger = vega.logger(vega.Debug, 'stderr');

const view = new vega.View(vega.parse(spec, null, { ast: false }), {
  renderer: 'none',
  logLevel: vega.Debug,
  logger: logger
});

try {
  await view.runAsync();
  console.log('✔ Runtime completed without error');
  const tree  = view.data('tree');
  const links = view.data('links');
  console.log('Tree nodes:', tree.length);
  console.log('Links:', links.length);
  console.log('Sample node:', JSON.stringify(tree[0], (k,v) => ['_id','_prev','children','parent','source','target'].includes(k) ? undefined : v, 2));
  console.log('Sample link path:', links[0]?.path?.substring(0, 60));
} catch(e) {
  console.error('✘ Runtime error:', e.message);
  // Try to identify which transform is failing
  console.error('Stack:', e.stack);
} finally {
  view.finalize();
}
