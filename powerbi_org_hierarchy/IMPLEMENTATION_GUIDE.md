# Power BI Organization Hierarchy — Deneb Visual
## Complete Step-by-Step Implementation Guide

---

## What You Will Build

A **senior-leadership-ready interactive organization chart** in Power BI using the Deneb custom visual and a Vega specification. Each person appears as a styled card showing:

| Card Section | Content |
|---|---|
| Colored header band | Org level label (C-Suite / VP / Director / Manager / IC) |
| Bold text (large) | Employee full name |
| Medium text | Job title |
| Italic footer (left) | Department |
| Italic footer (right) | Location |
| Hover tooltip | All attributes including Employee ID |

**Interactive features included:**
- Click a card → highlights it in orange
- Click again → deselects
- Hover → rich tooltip with all attributes
- Color-coded by hierarchy depth (level)

---

## Prerequisites

| Requirement | Details |
|---|---|
| Power BI Desktop | Version August 2023 or later (free download at powerbi.microsoft.com) |
| Deneb Custom Visual | From Microsoft AppSource or the Deneb GitHub releases |
| Your org data | As a flat table (parent–child format — see below) |

---

## Step 1 — Prepare Your Data Table

Your data must be a **flat table** with exactly these column names (case-sensitive):

| Column Name | Data Type | Description |
|---|---|---|
| `EmployeeID` | Text | Unique identifier for every person (e.g., "E001") |
| `ManagerID` | Text | EmployeeID of this person's direct manager. **Leave BLANK (null) for the CEO / top node** |
| `Name` | Text | Full display name |
| `Title` | Text | Job title |
| `Department` | Text | Department or division |
| `Location` | Text | Office city / region |

### Option A — Use the provided sample CSV

A ready-made sample file is included: `sample_org_data.csv`

1. Open Power BI Desktop
2. **Home → Get Data → Text/CSV**
3. Browse to `sample_org_data.csv` and click **Load**

### Option B — Use your own data from Excel / SharePoint / SQL

1. Load your existing data source
2. Use **Power Query (Transform Data)** to rename columns to match the exact names above
3. Ensure only **one row** has a blank/null `ManagerID` (the root/CEO)
4. Click **Close & Apply**

> **Critical rule:** Every `ManagerID` value must either be blank (root only) or exactly match an existing `EmployeeID`. Circular references will cause errors.

---

## Step 2 — Install the Deneb Visual

1. In Power BI Desktop, click the **three dots (…)** at the bottom of the Visualizations pane
2. Select **Get more visuals**
3. Search for **"Deneb"**
4. Click **Add** → confirm the prompt
5. The Deneb icon (a small flame/prism) now appears in your Visualizations pane

> **Offline install:** Download `deneb.xxx.pbiviz` from https://deneb-viz.github.io and use **Import a visual from a file** instead.

---

## Step 3 — Add Deneb to Your Report Canvas

1. Click the **Deneb visual icon** in the Visualizations pane
2. A placeholder appears on the canvas — **resize it** to fill most of the page (e.g., 1400 × 900 px)
   - Right-click the visual → **Format visual → Size** to set exact dimensions
3. With the Deneb visual selected, look at the **Fields pane** on the right

---

## Step 4 — Map Your Data Fields to Deneb

In the **Fields pane**, drag the following columns from your table into Deneb's **Values** bucket:

| Field to drag | Maps to |
|---|---|
| `EmployeeID` | drag to Values |
| `ManagerID` | drag to Values |
| `Name` | drag to Values |
| `Title` | drag to Values |
| `Department` | drag to Values |
| `Location` | drag to Values |

> Deneb exposes all fields dropped into Values as columns in its internal `dataset` table.
> The Vega template reads them by exactly these names.

---

## Step 5 — Open the Deneb Editor

1. Click the Deneb visual on the canvas
2. Click **Edit** (pencil icon) that appears at the top-right of the visual, OR
   double-click the visual
3. The **Deneb editor** opens — it has three panels:
   - Left: Preview canvas
   - Center: Specification (JSON editor)
   - Right: Settings / Config tabs

---

## Step 6 — Paste the Vega Template

1. In the Deneb editor, click the **Specification** tab (center panel)
2. At the top, make sure the **Vega** radio button is selected (not Vega-Lite)
3. **Select all** existing text in the editor (`Ctrl+A`) and **delete** it
4. Open the file `org_hierarchy_vega_template.json` from this folder in any text editor (Notepad, VS Code, etc.)
5. **Copy all** (`Ctrl+A`, `Ctrl+C`) and **paste** into the Deneb specification editor (`Ctrl+V`)
6. Click **Apply** (or press `Ctrl+Enter`)

The preview panel on the left should now render your organization hierarchy.

---

## Step 7 — Configure Deneb Settings

Click the **Config** tab in the Deneb editor and paste this configuration for clean rendering:

```json
{
  "font": "Segoe UI, sans-serif",
  "background": "#EEF2F7",
  "view": {
    "stroke": null
  }
}
```

Click **Apply**.

---

## Step 8 — Enable Tooltips

1. In the Deneb editor, click the **Settings** tab
2. Under **Tooltip**, set **Handler** to **Power BI** (recommended) or **Vega**
3. Click **Apply**

---

## Step 9 — Close Editor and Format the Visual

1. Click **Done** (top-right of Deneb editor) to return to the report
2. With the visual selected, use the **Format pane** to:
   - Set **Border** → Off (the card already has its own borders)
   - Set **Background** → Off (the Vega spec controls the background)
   - Set **Shadow** → On (optional — adds depth)

---

## Step 10 — Final Checks

| Check | Expected Result |
|---|---|
| All employees visible | Cards arranged in top-down tree layout |
| Root node at top | CEO / top-level person with dark navy header |
| Lines between cards | Gray orthogonal connector lines |
| Hover tooltip | Shows Name, Title, Dept, Location, Emp ID, Level |
| Click a card | Card border turns orange |
| Click again | Selection cleared |
| Legend at bottom | Color key for each level |

---

## Understanding the Visual Layout

```
                    ┌──────────────────────┐
                    │ ▸ C-SUITE             │  ← Dark navy header
                    │  Sarah Chen          │  ← Bold name
                    │  CEO                 │  ← Title
                    │ ──────────────────── │
                    │ Executive  New York  │  ← Dept | Location
                    └──────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │ ▸ VP/SVP   │  │ ▸ VP/SVP   │  │ ▸ VP/SVP   │
     │  Michael   │  │  Priya     │  │  James     │
     │  CFO       │  │  CTO       │  │  COO       │
     └────────────┘  └────────────┘  └────────────┘
```

---

## Customizing the Visual

### Change node card size
In the Vega `signals` section, adjust:
```json
{"name": "nodeW", "value": 200},   ← card width in pixels
{"name": "nodeH", "value": 98},    ← card height in pixels
{"name": "hdrH",  "value": 26}     ← header band height
```

### Change level colors
Find this signal in the spec and update the hex color codes:
```
datum.depth === 0 ? '#1E3A5F'   ← C-Suite (dark navy)
datum.depth === 1 ? '#1D4ED8'   ← VP (blue)
datum.depth === 2 ? '#0284C7'   ← Director (sky blue)
datum.depth === 3 ? '#059669'   ← Manager (green)
                  : '#7C3AED'   ← IC (purple)
```

### Change level labels
Find the `text` signal for the header label:
```
datum.depth === 0 ? '▸ C-SUITE'
datum.depth === 1 ? '▸ VP / SVP'
datum.depth === 2 ? '▸ DIRECTOR'
datum.depth === 3 ? '▸ MANAGER'
                  : '▸ INDIVIDUAL CONTRIBUTOR'
```
Edit these strings to match your organization's level naming.

### Add more attributes (e.g., headcount, budget)
1. Add the column to your Power BI table and drag it into Deneb's Values bucket
2. In the Vega spec, add a new `text` mark inside the `nodeGroup` marks array:
```json
{
  "type": "text",
  "encode": {
    "update": {
      "x": {"value": 9},
      "y": {"value": 90},
      "text": {"field": "YourNewColumn"},
      "fill": {"value": "#475569"},
      "fontSize": {"value": 9}
    }
  }
}
```
3. Increase `nodeH` signal value to accommodate the extra line.

### Change layout direction (horizontal tree)
In the `tree` transform, change:
```json
"size": [{"signal": "height - gapY - 60"}, {"signal": "width - gapX"}]
```
And in the `linkpath` transform, change:
```json
"orient": "horizontal"
```
Then swap `x` and `y` assignments in the nodeGroup encode.

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| "Cannot find field 'EmployeeID'" | Field name mismatch | Ensure your Power BI column is named exactly `EmployeeID` |
| Visual shows blank | Wrong spec type selected | Make sure **Vega** (not Vega-Lite) is selected in Deneb |
| Only one node shown | Multiple root rows | Ensure exactly one row has blank `ManagerID` |
| Circular reference error | A → B → A loop in data | Fix the parent chain in your source data |
| Nodes overlap | Too many sibling nodes | Increase canvas width or reduce `nodeW` signal value |
| Tooltip not showing | Tooltip handler not set | Set Tooltip Handler to "Power BI" in Deneb Settings tab |
| Cards cut off at edges | Canvas too small | Resize Deneb visual or increase `padding` in the spec |

---

## File Reference

| File | Purpose |
|---|---|
| `org_hierarchy_vega_template.json` | The complete Vega specification — paste into Deneb |
| `sample_org_data.csv` | 22-person sample dataset for testing |
| `IMPLEMENTATION_GUIDE.md` | This guide |

---

## Tips for Senior Leadership Presentations

- Set your Power BI page size to **16:9 Widescreen** and make the Deneb visual full-page
- Add a **slicer** on Department or Location to filter the hierarchy dynamically
- Use **Power BI bookmarks** to save views at different zoom levels
- Pair with a **card visual** showing total headcount that updates when filters are applied
- Export to PDF for board presentations: **File → Export → PDF**

---

*Generated for Power BI + Deneb v1.6+ | Vega v5 specification*
