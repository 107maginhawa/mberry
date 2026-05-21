<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M18 Surveys & Polls -- Component Specifications

## Component Index

| Component ID | Name | Used In |
|-------------|------|---------|
| M18-C01 | SurveyTable | M18-S01 |
| M18-C02 | SurveyBuilderForm | M18-S02, M18-S03 |
| M18-C03 | QuestionBlock | M18-S02, M18-S03 |
| M18-C04 | QuestionInput | M18-S06 |
| M18-C05 | SurveyResultsDashboard | M18-S04 |
| M18-C06 | QuestionResultChart | M18-S04 |
| M18-C07 | SurveyCard | M18-S05 |
| M18-C08 | QuickPoll | M18-S07 |
| M18-C09 | PollCreatorForm | M18-S08 |
| M18-C10 | SurveyStatusBadge | M18-S01, M18-S04, M18-S05 |
| M18-C11 | SurveyTypeBadge | M18-S01, M18-S04, M18-S05, M18-S06 |
| M18-C12 | BarChart | M18-S04, M18-S07 |
| M18-C13 | RatingDisplay | M18-S04 |
| M18-C14 | DeadlineIndicator | M18-S01, M18-S05 |

---

## M18-C01: SurveyTable

### TypeScript Props

```typescript
interface SurveyTableProps {
  surveys: Array<{
    id: string;
    title: string;
    type: "anonymous" | "identified";
    status: "draft" | "active" | "closed";
    totalResponses: number;
    deadline: string | null;
    createdAt: string;
  }>;
  activeTab: "all" | "draft" | "active" | "closed";
  onTabChange: (tab: SurveyTableProps["activeTab"]) => void;
  onPublish: (surveyId: string) => void;
  onClose: (surveyId: string) => void;
  onDelete: (surveyId: string) => void;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}
```

### WAI-ARIA Pattern

- Tab filter: `role="tablist"` with `role="tab"` buttons, `aria-selected` on active
- Table: `role="table"` with `aria-label="Surveys"`
- Sort headers: `aria-sort` attribute
- Action menu: `role="menu"` triggered by kebab button

### Keyboard Spec

| Key | Action |
|-----|--------|
| Arrow Left/Right | Navigate tabs |
| Tab | Move from tabs to table to actions |
| Enter/Space (on tab) | Activate tab filter |
| Enter/Space (on action) | Trigger action |

### Render Contract

| Condition | Renders |
|-----------|---------|
| isLoading | Skeleton rows (5) |
| surveys.length is 0 | Empty state per activeTab |
| status is "draft" | Edit + Publish + Delete actions |
| status is "active" | Results + Close actions |
| status is "closed" | Results + Export actions |

---

## M18-C02: SurveyBuilderForm

### TypeScript Props

```typescript
interface SurveyBuilderFormProps {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    title: string;
    type: "anonymous" | "identified";
    deadline: string | null;
    questions: QuestionDefinition[];
    distribution?: "all_members" | "category_filter" | "manual";
    distributionFilter?: string[];
  } | null;
  onSaveDraft: (data: SurveyFormData) => void;
  onPublish: (data: SurveyFormData) => void;
  isSaving: boolean;
}

interface SurveyFormData {
  title: string;
  type: "anonymous" | "identified";
  deadline: string | null;
  questions: QuestionDefinition[];
  distribution: "all_members" | "category_filter" | "manual";
  distributionFilter?: string[];
}

interface QuestionDefinition {
  id: string;
  label: string;
  type: "multiple_choice" | "rating" | "text" | "checkbox";
  required: boolean;
  options?: string[];
  ratingScale?: 5 | 10;
}
```

### WAI-ARIA Pattern

- Form: `aria-label="Create survey"` or `"Edit survey"`
- Question list: `role="list"` with drag-and-drop reorder
- Each question: `role="listitem"` with `aria-label="Question {n}: {label}"`
- Drag handle: `aria-roledescription="sortable"`, `aria-label="Reorder question {n}"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle through settings, then questions, then actions |
| Space (on drag handle) | Enter reorder mode |
| Arrow Up/Down (reorder mode) | Move question |
| Escape (reorder mode) | Cancel reorder |
| Enter (reorder mode) | Drop question |

### Render Contract

| Condition | Renders |
|-----------|---------|
| mode is "create" | Empty form, 1 blank question |
| mode is "edit" | Populated form from initialData |
| questions.length is 0 | "Add your first question" placeholder |
| isSaving | Both buttons disabled with spinner |
| Publish validation fails | Error: "Add at least 1 question and set a deadline to publish." |

---

## M18-C03: QuestionBlock

### TypeScript Props

```typescript
interface QuestionBlockProps {
  index: number;
  question: QuestionDefinition;
  onChange: (updated: QuestionDefinition) => void;
  onRemove: () => void;
  canRemove: boolean;
}
```

### WAI-ARIA Pattern

- Container: `role="listitem"` with `aria-label="Question {index + 1}"`
- Type selector: `aria-label="Question type"`
- Required toggle: `role="switch"` with `aria-checked` and `aria-label="Required question"`
- Options list (MC/checkbox): `role="list"` with add/remove buttons
- Remove button: `aria-label="Remove question {index + 1}"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle through label, type, required, options, remove |
| Enter (in option input) | Add new option below |
| Backspace (empty option) | Remove option |
| Delete | Remove question (with confirmation) |

### Render Contract

| Condition | Renders |
|-----------|---------|
| type is "multiple_choice" or "checkbox" | Options list with add/remove |
| type is "rating" | Rating scale selector (5 or 10) |
| type is "text" | No additional config |
| canRemove is false | Remove button hidden (last question) |
| options.length < 2 (MC/checkbox) | "Add at least 2 options" validation |

---

## M18-C04: QuestionInput

### TypeScript Props

```typescript
interface QuestionInputProps {
  question: {
    id: string;
    label: string;
    type: "multiple_choice" | "rating" | "text" | "checkbox";
    required: boolean;
    options?: string[];
    ratingScale?: 5 | 10;
  };
  value: string | number | string[] | null;
  onChange: (value: string | number | string[]) => void;
  error?: string | null;
  disabled: boolean;
}
```

### WAI-ARIA Pattern

- Fieldset: `<fieldset>` with `<legend>{label}</legend>`
- Required indicator: `aria-required="true"` on fieldset
- MC options: `role="radiogroup"` with `<input type="radio">`
- Checkbox options: `role="group"` with `<input type="checkbox">`
- Rating: `role="radiogroup"` with star/number buttons
- Text: `<textarea>` with `aria-label="{label}"`
- Error: `aria-describedby="error-{id}"`, `aria-invalid="true"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Arrow keys (MC/rating) | Navigate options |
| Space (checkbox) | Toggle option |
| Tab | Move between questions |

### Render Contract

| Condition | Renders |
|-----------|---------|
| type is "multiple_choice" | Radio buttons for each option |
| type is "checkbox" | Checkboxes for each option |
| type is "rating" | Star rating or numbered buttons (1 to ratingScale) |
| type is "text" | Textarea with char count |
| error is present | Red border + error message below |
| disabled is true | All inputs disabled (submitting or closed) |

---

## M18-C05: SurveyResultsDashboard

### TypeScript Props

```typescript
interface SurveyResultsDashboardProps {
  surveyId: string;
  title: string;
  type: "anonymous" | "identified";
  status: "draft" | "active" | "closed";
  totalResponses: number;
  eligibleCount: number | null;
  questions: Array<{
    questionId: string;
    label: string;
    type: "multiple_choice" | "rating" | "text" | "checkbox";
    responseCount: number;
    aggregation: QuestionAggregation;
  }>;
  onExport: () => void;
  isExporting: boolean;
}

type QuestionAggregation = {
  choices?: Array<{ option: string; count: number; percentage: number }>;
  average?: number;
  distribution?: Record<string, number>;
  textResponses?: string[];
};
```

### WAI-ARIA Pattern

- Overview section: `aria-label="Survey overview"`
- Response count: `role="status"` with `aria-live="polite"`
- Question results: `role="list"` with `role="listitem"` per question
- Charts: `role="img"` with `aria-label` describing the data
- Export: `aria-label="Export results as CSV"`

### Render Contract

| Condition | Renders |
|-----------|---------|
| totalResponses is 0 | "No responses yet." message |
| status is "active" | Live indicator dot + auto-refresh toggle |
| type is "anonymous" | No respondent identity links anywhere |
| isExporting | Spinner on export button |
| eligibleCount is not null | Response rate percentage |

---

## M18-C06: QuestionResultChart

### TypeScript Props

```typescript
interface QuestionResultChartProps {
  label: string;
  type: "multiple_choice" | "rating" | "text" | "checkbox";
  responseCount: number;
  aggregation: QuestionAggregation;
}
```

### WAI-ARIA Pattern

- Container: `aria-label="Results for: {label}"`
- Bar chart: `role="img"` with `aria-label` summarizing data
- Each bar: `aria-label="{option}: {count} ({percentage}%)"`
- Rating display: `aria-label="Average rating: {average} out of {scale}"`
- Text responses: `role="list"` with expandable items

### Render Contract

| Type | Visualization |
|------|---------------|
| multiple_choice | Horizontal bars with labels, counts, percentages |
| checkbox | Same as MC (bars can sum > 100%) |
| rating | Large average number + star visualization + histogram |
| text | Scrollable list, truncated at 3 lines, "Show more" expander |

---

## M18-C07: SurveyCard

### TypeScript Props

```typescript
interface SurveyCardProps {
  id: string;
  title: string;
  type: "anonymous" | "identified";
  deadline: string | null;
  hasResponded: boolean;
  canEdit: boolean;
}
```

### WAI-ARIA Pattern

- Card: `<article aria-labelledby="survey-title-{id}">`
- Title: `<h3 id="survey-title-{id}">`
- Deadline: `aria-label="Deadline: {formatted date}"`
- Status: `aria-label="Completed"` or `"Pending response"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Enter/Space | Navigate to response form |
| Tab | Move to next card |

### Render Contract

| Condition | Renders |
|-----------|---------|
| hasResponded is false | "Respond" CTA, pending badge |
| hasResponded is true, canEdit is true | "Edit Response" link, completed badge |
| hasResponded is true, canEdit is false | "Completed" badge, no link |
| deadline < 3 days away | Amber "Due soon" indicator |
| deadline passed | "Deadline passed" gray badge |

---

## M18-C08: QuickPoll

### TypeScript Props

```typescript
interface QuickPollProps {
  pollId: string;
  question: string;
  options: string[];
  hasVoted: boolean;
  userVote?: string | null;
  results?: {
    totalVotes: number;
    options: Array<{ option: string; count: number; percentage: number }>;
  } | null;
  isClosed: boolean;
  onVote: (option: string) => void;
  isVoting: boolean;
}
```

### WAI-ARIA Pattern

- Container: `<article aria-label="Poll: {question}">`
- Voting form: `aria-label="Vote on poll"`, `role="radiogroup"`
- Results: `aria-label="Poll results"`, `role="img"` for chart
- Total votes: `role="status"` with `aria-live="polite"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Arrow keys | Navigate poll options |
| Space/Enter | Select option / submit vote |

### Render Contract

| Condition | Renders |
|-----------|---------|
| hasVoted is false, isClosed is false | Radio options + Vote button |
| hasVoted is true | Result bars with user's vote highlighted |
| isClosed is true | Result bars + "Poll closed" badge |
| isVoting | Button spinner, radios disabled |

---

## M18-C09: PollCreatorForm

### TypeScript Props

```typescript
interface PollCreatorFormProps {
  onSuccess: (pollId: string) => void;
}
```

### WAI-ARIA Pattern

- Form: `aria-label="Create poll"`
- Question: `aria-required="true"`
- Options list: `role="list"` with add/remove per item
- Add option: `aria-label="Add option"`
- Remove option: `aria-label="Remove option {n}"`

### Keyboard Spec

| Key | Action |
|-----|--------|
| Tab | Cycle through question, options, deadline, submit |
| Enter (in option) | Add new option below |
| Backspace (empty option) | Remove option |

### Render Contract

| Condition | Renders |
|-----------|---------|
| options.length >= 10 | Add button disabled |
| options.length <= 2 | Remove buttons hidden |
| isSubmitting | Spinner, fields disabled |
| Duplicate options detected | "Options must be unique." error |

---

## M18-C10: SurveyStatusBadge

### TypeScript Props

```typescript
interface SurveyStatusBadgeProps {
  status: "draft" | "active" | "closed";
}
```

### Render Contract

| Status | Color | Icon |
|--------|-------|------|
| draft | Gray | Pencil |
| active | Green | Radio tower |
| closed | Amber | Lock |

---

## M18-C11: SurveyTypeBadge

### TypeScript Props

```typescript
interface SurveyTypeBadgeProps {
  type: "anonymous" | "identified";
}
```

### Render Contract

| Type | Color | Icon | Label |
|------|-------|------|-------|
| anonymous | Purple | EyeOff | "Anonymous" |
| identified | Blue | User | "Identified" |

---

## M18-C12: BarChart

### TypeScript Props

```typescript
interface BarChartProps {
  items: Array<{
    label: string;
    value: number;
    percentage: number;
    highlighted?: boolean;
  }>;
  ariaLabel: string;
}
```

### WAI-ARIA Pattern

- Container: `role="img"` with `aria-label="{ariaLabel}"`
- Each bar: `aria-label="{label}: {value} ({percentage}%)"`
- Highlighted bar (user's vote): visually distinct, `aria-current="true"`

---

## M18-C13: RatingDisplay

### TypeScript Props

```typescript
interface RatingDisplayProps {
  average: number;
  scale: 5 | 10;
  distribution: Record<string, number>;
  totalResponses: number;
}
```

### WAI-ARIA Pattern

- Container: `aria-label="Average rating: {average} out of {scale} from {totalResponses} responses"`
- Stars: decorative (`aria-hidden="true"`), text value is the accessible label
- Distribution histogram: `role="img"` with descriptive `aria-label`

---

## M18-C14: DeadlineIndicator

### TypeScript Props

```typescript
interface DeadlineIndicatorProps {
  deadline: string | null;
  status: "draft" | "active" | "closed";
}
```

### Render Contract

| Condition | Renders |
|-----------|---------|
| deadline is null | "No deadline" (gray text) |
| deadline > 3 days away | Formatted date (default text) |
| deadline <= 3 days and > 0 | "Due in {n} days" (amber) |
| deadline <= 24 hours | "Due today" or "Due tomorrow" (red) |
| deadline passed | "Deadline passed" (gray, strikethrough) |
| status is "closed" | "Closed" (no deadline shown) |
