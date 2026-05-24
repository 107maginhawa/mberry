---
slice: comms-template-preview
phase: wave4-comms-phase3
module: communications
---

# Slice: Template Preview Pane (Split Editor)

## Overview
Upgrade officer template form to show side-by-side editor and live preview. Left pane: template content with merge field insertion. Right pane: rendered preview with sample data.

## Acceptance Criteria

- **AC-001**: Template form renders split layout (editor left, preview right) on desktop
- **AC-002**: Preview pane updates live as user types in editor
- **AC-003**: Merge fields ({{name}}, {{amount}}, etc.) render with sample values in preview
- **AC-004**: Mobile view stacks editor above preview (responsive)
- **AC-005**: Preview pane has "Mobile" toggle to show narrow-width preview

## Business Rules

- **BR-001**: IF template content is empty, THEN preview shows placeholder text "Start typing to see preview"
- **BR-002**: IF merge field has no sample value mapping, THEN render as-is with highlighted styling

## Files in Scope
- `apps/memberry/src/features/communications/components/template-form.tsx` (modify)
- `apps/memberry/src/features/communications/components/template-preview.tsx` (modify/enhance)
- Test file: `apps/memberry/src/features/communications/__tests__/template-preview.test.tsx`

## Out of Scope
- Backend template API changes
- A/B testing of templates
