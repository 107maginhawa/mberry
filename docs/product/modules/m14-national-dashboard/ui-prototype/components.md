<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Components: National Dashboard (M14)

---

## Component: KpiSummaryCard

**Purpose:** Display a single KPI metric with trend indicator
**Used In:** National Dashboard Home, Chapter Drill-Down
**WAI-ARIA Pattern:** none
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface KpiSummaryCardProps {
  /** KPI label (e.g., "Total Members") */
  label: string;
  /** Current value */
  value: number;
  /** Display format */
  format: "number" | "percent" | "currency";
  /** Trend direction compared to previous period */
  trend: "up" | "down" | "neutral";
  /** Trend percentage change */
  trendValue: number | null;
  /** Accessible description of the metric */
  ariaDescription: string;
}
```

### Render Contract

- **Visual output:** Card with label, large formatted value, trend arrow icon with percentage change
- **Slots/children:** None
- **Conditional rendering:**
  - Trend arrow: up (green), down (red), neutral (gray)
  - trendValue: hidden if null
  - Currency format: not used in current module but supported for reuse

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| (none) | -- | Read-only display component |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus on card (for screen reader announcement) |

### States
- **Default:** Populated card with value and trend
- **Loading:** Skeleton rectangle matching card dimensions
- **Disabled:** N/A
- **Error:** "---" placeholder with "Unable to load" tooltip
- **Success:** N/A (always read-only)

### Should Contain
- Number formatting (thousands separators, percentage sign)
- Trend arrow rendering
- Accessible value announcement

### Should NOT Contain
- Data fetching
- Trend calculation logic

### Reuse Notes
- Highly reusable across any dashboard module (billing, events, advertising)

---

## Component: TrendChart

**Purpose:** Display time-series data as line or bar chart
**Used In:** National Dashboard Home
**WAI-ARIA Pattern:** none (image with aria-label)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface TrendChartProps {
  /** Chart title */
  title: string;
  /** Chart type */
  chartType: "line" | "bar";
  /** Data series */
  data: Array<{
    label: string;
    values: Array<{ date: string; value: number }>;
    color?: string;
  }>;
  /** X-axis label */
  xAxisLabel: string;
  /** Y-axis label */
  yAxisLabel: string;
  /** Whether to show legend */
  showLegend: boolean;
  /** Accessible summary of the chart data */
  ariaSummary: string;
}
```

### Render Contract

- **Visual output:** Responsive chart with axes, data series, optional legend, tooltip on hover
- **Slots/children:** None
- **Conditional rendering:**
  - Legend: shown if showLegend=true and multiple data series
  - Tooltip: appears on hover/focus of data points

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| (none) | -- | Read-only display component |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus on chart region |
| Arrow Left/Right | Navigate data points (when focused) |

### States
- **Default:** Chart rendered with data
- **Loading:** Skeleton rectangle matching chart dimensions with shimmer
- **Disabled:** N/A
- **Error:** "Unable to load chart data" placeholder
- **Success:** N/A

### Should Contain
- Chart rendering (via charting library)
- Responsive sizing
- Accessible data table fallback (hidden, for screen readers)

### Should NOT Contain
- Data fetching or aggregation
- Date range logic

### Reuse Notes
- Reusable for any time-series visualization (billing revenue, event attendance)

---

## Component: ChapterComparisonTable

**Purpose:** Sortable, clickable table comparing chapter-level metrics
**Used In:** National Dashboard Home
**WAI-ARIA Pattern:** grid
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/grid/

### TypeScript Props Interface

```typescript
interface ChapterComparisonTableProps {
  /** Chapter data rows */
  chapters: Array<{
    organizationId: string;
    organizationName: string;
    memberCount: number;
    activePercent: number;
    collectionRate: number;
    compliancePercent: number;
  }>;
  /** Currently sorted column */
  sortColumn: string;
  /** Sort direction */
  sortDirection: "asc" | "desc";
  /** Callback fired when sort changes */
  onSortChange: (column: string, direction: "asc" | "desc") => void;
  /** Callback fired when chapter row clicked */
  onChapterClick: (organizationId: string) => void;
  /** Whether data is loading */
  isLoading: boolean;
}
```

### Render Contract

- **Visual output:** Table with sortable column headers, clickable rows, metric cells with conditional coloring (red/yellow/green based on thresholds)
- **Slots/children:** None
- **Conditional rendering:**
  - Sort indicators on active column
  - Color-coded cells: green (>80%), yellow (50-80%), red (<50%) for percentage metrics
  - Loading: skeleton rows

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onSortChange | `(column: string, direction: "asc" \| "desc") => void` | Column sort changed |
| onChapterClick | `(organizationId: string) => void` | Chapter row clicked for drill-down |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus table, then individual rows |
| Arrow Up/Down | Navigate between rows |
| Enter | Drill-down into focused chapter row |
| Space | Toggle sort on focused column header |

### States
- **Default:** Populated table with sortable columns
- **Loading:** Skeleton rows (5-8) with shimmer
- **Disabled:** N/A
- **Error:** "Unable to load chapter data" with retry
- **Success:** N/A (read-only)

### Should Contain
- Sort logic (client-side)
- Conditional cell coloring
- Row click handling

### Should NOT Contain
- Data fetching
- Drill-down navigation (callback to parent)

### Reuse Notes
- Table pattern reusable; specific columns are module-specific

---

## Component: DateRangeSelector

**Purpose:** Select date range for dashboard data filtering
**Used In:** National Dashboard Home
**WAI-ARIA Pattern:** combobox (preset) + dialog (custom picker)
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

### TypeScript Props Interface

```typescript
interface DateRangeSelectorProps {
  /** Currently selected date range */
  value: { from: string; to: string };
  /** Preset options */
  presets: Array<{ label: string; from: string; to: string }>;
  /** Callback fired when range changes */
  onChange: (range: { from: string; to: string }) => void;
}
```

### Render Contract

- **Visual output:** Dropdown with preset options (This Month, This Quarter, This Year) + "Custom" option that opens date picker
- **Slots/children:** None
- **Conditional rendering:** Custom date picker dialog only when "Custom" selected

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onChange | `(range: { from: string; to: string }) => void` | Date range changed |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus selector |
| Enter/Space | Open dropdown |
| Arrow Up/Down | Navigate presets |
| Enter | Select preset |
| Escape | Close dropdown |

### States
- **Default:** Selected range displayed (e.g., "This Quarter")
- **Loading:** N/A
- **Disabled:** N/A
- **Error:** Invalid custom range — "Start date must be before end date"
- **Success:** N/A

### Should Contain
- Preset calculation (this month, this quarter, this year)
- Custom date picker integration
- Date format display

### Should NOT Contain
- Dashboard data refetching

### Reuse Notes
- Reusable across any dashboard with date filtering

---

## Component: ExportButton

**Purpose:** Trigger data export in CSV or PDF format
**Used In:** National Dashboard Home, Chapter Drill-Down
**WAI-ARIA Pattern:** menu
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/menu/

### TypeScript Props Interface

```typescript
interface ExportButtonProps {
  /** Available export formats */
  formats: Array<"csv" | "pdf">;
  /** Callback fired when export requested */
  onExport: (format: "csv" | "pdf") => void;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Async job status (for large exports) */
  asyncJob: { jobId: string; status: "processing" | "complete"; pollUrl: string } | null;
}
```

### Render Contract

- **Visual output:** Button with dropdown menu showing format options. Shows spinner when exporting. Shows progress for async jobs.
- **Slots/children:** None
- **Conditional rendering:**
  - Spinner on button when isExporting=true
  - Async job progress bar when asyncJob is not null and status="processing"

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onExport | `(format: "csv" \| "pdf") => void` | Export format selected |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Enter/Space | Open format menu |
| Arrow Up/Down | Navigate format options |
| Enter | Select format |
| Escape | Close menu |

### States
- **Default:** Button with export icon
- **Loading:** Spinner replacing icon, "Exporting..." label
- **Disabled:** During active export
- **Error:** Sonner toast "Export failed. Please try again."
- **Success:** Sonner toast "Export downloaded" + browser download trigger

### Should Contain
- Format menu presentation
- Export progress indicator
- Async job polling UI

### Should NOT Contain
- Export API calls
- File generation logic

### Reuse Notes
- Reusable for any data export across modules

---

## Component: StatusBreakdownChart

**Purpose:** Donut/pie chart showing member status distribution
**Used In:** Chapter Drill-Down
**WAI-ARIA Pattern:** none (image with aria-label)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface StatusBreakdownChartProps {
  /** Status segments */
  data: Array<{
    status: string;
    count: number;
    color: string;
  }>;
  /** Total count (center of donut) */
  total: number;
  /** Accessible summary */
  ariaSummary: string;
}
```

### Render Contract

- **Visual output:** Donut chart with segments, center total, hover tooltips with count and percentage
- **Slots/children:** None
- **Conditional rendering:** Segments only shown for non-zero counts

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| (none) | -- | Read-only display |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus chart (screen reader reads aria summary) |

### States
- **Default:** Donut chart with colored segments
- **Loading:** Skeleton circle
- **Disabled:** N/A
- **Error:** "Unable to load status data" placeholder
- **Success:** N/A

### Should Contain
- Chart rendering
- Percentage calculation
- Accessible data table fallback

### Should NOT Contain
- Data fetching

### Reuse Notes
- Reusable for any status distribution visualization
