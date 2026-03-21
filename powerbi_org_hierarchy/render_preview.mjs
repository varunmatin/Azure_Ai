/**
 * Renders the org hierarchy Vega spec to SVG and PNG preview files.
 */
import * as vega from 'vega';
import { readFileSync, writeFileSync } from 'fs';
import { createCanvas } from 'canvas';

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
const spec    = JSON.parse(specRaw);

// Inject Power BI sample data (simulates what Deneb does)
spec.data.find(d => d.name === 'dataset').values = dataset;

// ── SVG render ────────────────────────────────────────────────────────────
console.log('Rendering SVG…');
const svgView = new vega.View(vega.parse(spec), { renderer: 'none' });
const svg = await svgView.toSVG();
writeFileSync('./org_hierarchy_preview.svg', svg);
svgView.finalize();
console.log('  ✔ org_hierarchy_preview.svg written');

// ── PNG render via node-canvas ─────────────────────────────────────────────
console.log('Rendering PNG…');

// Register node-canvas with Vega's canvas renderer
const { CanvasRenderer } = vega;
CanvasRenderer.prototype.canvas = function() {
  if (!this._canvas) {
    this._canvas = createCanvas(this._width * this._origin[0] || 1, this._height * this._origin[1] || 1);
  }
  return this._canvas;
};

const pngView = new vega.View(vega.parse(spec), {
  renderer: 'none',
  logLevel: vega.Warn
});
await pngView.runAsync();
// Use toCanvas with the node-canvas factory
const canvas = await pngView.toCanvas(2, { type: 'png', context: { createCanvas } });
const pngBuffer = canvas.toBuffer('image/png');
writeFileSync('./org_hierarchy_preview.png', pngBuffer);
pngView.finalize();
console.log('  ✔ org_hierarchy_preview.png written');
console.log(`\nDone. Preview files saved to powerbi_org_hierarchy/`);
