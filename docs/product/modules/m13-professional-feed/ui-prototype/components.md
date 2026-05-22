<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Components: Professional Feed (M13)

---

## Component: PostCard

**Purpose:** Display a single feed post with author info, content, images, and actions
**Used In:** Feed Main
**WAI-ARIA Pattern:** feed (article)
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/feed/

### TypeScript Props Interface

```typescript
interface PostCardProps {
  /** Post data from API */
  post: {
    id: string;
    organizationId: string;
    authorId: string;
    postType: "announcement" | "event_highlight" | "training_opportunity" | "achievement" | "clinical_update";
    body: string;
    imageUrls: string[] | null;
    visibility: "org" | "network";
    status: "draft" | "published" | "hidden" | "removed";
    createdAt: string;
    updatedAt: string;
    author: {
      displayName: string;
      avatarUrl: string | null;
    };
  };
  /** Whether current user can moderate (hide/remove) */
  canModerate: boolean;
  /** Whether current user can engage (like/bookmark) */
  canEngage: boolean;
  /** Whether the post author is muted by current user */
  isMuted: boolean;
  /** Callback fired when mute/unmute toggled */
  onToggleMute: (authorId: string) => void;
  /** Callback fired when post reported */
  onReport: (postId: string) => void;
  /** Callback fired when post hidden (moderation) */
  onHide: (postId: string) => void;
  /** Callback fired when post removed (moderation) */
  onRemove: (postId: string) => void;
  /** Callback fired when hidden post restored */
  onUnhide: (postId: string) => void;
}
```

### Render Contract

- **Visual output:** Card with author avatar + name, post type badge, body text (truncated at 280 chars with "Read more"), image grid (1-4 images), relative timestamp, action bar
- **Slots/children:** None
- **Conditional rendering:**
  - "Read more" link: only if body > 280 chars
  - Image grid: only if imageUrls is non-empty
  - Moderation actions (hide/remove/unhide): only if canModerate=true
  - Engagement buttons (like/bookmark): disabled if canEngage=false
  - Status badge ("Hidden", "Draft"): only if canModerate=true and status is not "published"
  - "Network" visibility badge: only if visibility="network"
  - Muted indicator: never shown (muted posts are filtered out)

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onToggleMute | `(authorId: string) => void` | Mute or unmute the post author |
| onReport | `(postId: string) => void` | Report post for moderation |
| onHide | `(postId: string) => void` | Hide post (officer moderation) |
| onRemove | `(postId: string) => void` | Remove post permanently (officer moderation) |
| onUnhide | `(postId: string) => void` | Restore hidden post |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Move focus to next focusable element within card (actions) |
| Enter | Activate focused action (like, mute, report, etc.) |
| Escape | Close action dropdown menu if open |
| Arrow Down/Up | Navigate between posts in the feed |

### States
- **Default:** Post card with full content and actions
- **Loading:** Skeleton card matching layout dimensions
- **Disabled:** Engagement buttons disabled for non-active members
- **Error:** "Failed to load post" with retry
- **Success:** Brief highlight animation after creation

### Should Contain
- Presentation logic for post display
- Truncation logic for body text
- Image grid layout logic
- Relative time formatting

### Should NOT Contain
- Feed pagination logic
- Mute filtering logic
- Direct API calls
- Permission determination logic

### Reuse Notes
- PostCard is specific to feed module; not shared cross-module

---

## Component: PostTypeFilter

**Purpose:** Filter feed posts by content type
**Used In:** Feed Main
**WAI-ARIA Pattern:** toolbar
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/

### TypeScript Props Interface

```typescript
interface PostTypeFilterProps {
  /** Currently selected post types (multi-select) */
  selectedTypes: Array<"announcement" | "event_highlight" | "training_opportunity" | "achievement" | "clinical_update">;
  /** Callback fired when selection changes */
  onSelectionChange: (types: Array<"announcement" | "event_highlight" | "training_opportunity" | "achievement" | "clinical_update">) => void;
}
```

### Render Contract

- **Visual output:** Horizontal row of toggle chips, one per post type enum value, with type-specific icons
- **Slots/children:** None
- **Conditional rendering:** Active chips have filled background, inactive have outline

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onSelectionChange | `(types: PostType[]) => void` | Updated selection array |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Move focus into/out of filter toolbar |
| Arrow Left/Right | Navigate between filter chips |
| Enter/Space | Toggle selected chip |

### States
- **Default:** All chips unselected (show all types)
- **Loading:** N/A (client-side filter)
- **Disabled:** N/A
- **Error:** N/A
- **Success:** N/A

### Should Contain
- Toggle chip presentation
- Multi-select state management

### Should NOT Contain
- Feed data fetching
- Post filtering logic (parent handles)

### Reuse Notes
- Pattern reusable for any enum-based filter chip set

---

## Component: CreatePostForm

**Purpose:** Compose and submit a new feed post
**Used In:** Create Post (modal)
**WAI-ARIA Pattern:** dialog (when in modal) / none (when inline)
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

### TypeScript Props Interface

```typescript
interface CreatePostFormProps {
  /** Organization ID for the post */
  organizationId: string;
  /** Callback fired on successful submission */
  onSubmit: (data: CreatePostPayload) => void;
  /** Callback fired on cancel */
  onCancel: () => void;
  /** Whether form is currently submitting */
  isSubmitting: boolean;
}

interface CreatePostPayload {
  postType: "announcement" | "event_highlight" | "training_opportunity" | "achievement" | "clinical_update";
  body: string;
  imageUrls: string[];
  visibility: "org" | "network";
  status: "draft" | "published";
}
```

### Render Contract

- **Visual output:** Form with post type select, textarea with character counter, image upload zone (max 4), visibility toggle, action buttons (Publish, Save as Draft, Cancel)
- **Slots/children:** None
- **Conditional rendering:**
  - Character counter color: green (<1500), yellow (1500-1900), red (>1900)
  - Image upload button: disabled after 4 images
  - Draft button: always visible alongside Publish

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onSubmit | `(data: CreatePostPayload) => void` | Form submitted with validated data |
| onCancel | `() => void` | User cancelled form |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Move between form fields |
| Ctrl+Enter | Submit form (publish) |
| Escape | Cancel and close (if modal) |
| Space | Toggle visibility switch |

### States
- **Default:** Blank form, post type selector focused
- **Loading:** Submit button shows spinner, fields disabled
- **Disabled:** N/A (only accessible by officers)
- **Error:** Inline field validation errors
- **Success:** Modal closes, parent handles toast

### Should Contain
- Form field presentation
- Character counter logic
- Image preview thumbnails
- Client-side validation (max chars, max images)

### Should NOT Contain
- Image upload to storage (parent handles via storage module)
- API submission logic
- Permission checks

### Reuse Notes
- Specific to feed module

---

## Component: ImageGrid

**Purpose:** Display 1-4 post images in responsive grid layout
**Used In:** PostCard
**WAI-ARIA Pattern:** none
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface ImageGridProps {
  /** Array of image URLs (1-4) */
  imageUrls: string[];
  /** Alt text prefix for accessibility */
  altPrefix: string;
  /** Callback fired when image clicked (lightbox) */
  onImageClick: (index: number) => void;
}
```

### Render Contract

- **Visual output:** Responsive image grid — 1 image: full width; 2 images: side-by-side; 3-4 images: 2x2 grid
- **Slots/children:** None
- **Conditional rendering:** Grid layout adapts to image count

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onImageClick | `(index: number) => void` | Image tapped for lightbox view |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Focus each image in order |
| Enter | Open lightbox for focused image |

### States
- **Default:** Images loaded in grid
- **Loading:** Skeleton placeholders matching aspect ratio
- **Disabled:** N/A
- **Error:** Broken image placeholder icon
- **Success:** N/A

### Should Contain
- Grid layout calculation based on image count
- Lazy loading with `loading="lazy"`
- Aspect ratio preservation

### Should NOT Contain
- Image upload logic
- Lightbox implementation (callback to parent)

### Reuse Notes
- Reusable for any multi-image display (events, documents)

---

## Component: MuteButton

**Purpose:** Toggle mute/unmute for a post author
**Used In:** PostCard (action menu)
**WAI-ARIA Pattern:** none (button)
**ARIA Pattern Reference:** N/A

### TypeScript Props Interface

```typescript
interface MuteButtonProps {
  /** Author person ID */
  authorId: string;
  /** Author display name for aria-label */
  authorName: string;
  /** Whether author is currently muted */
  isMuted: boolean;
  /** Callback fired on toggle */
  onToggle: (authorId: string) => void;
}
```

### Render Contract

- **Visual output:** Button with icon — muted: "Unmute {name}", not muted: "Mute {name}"
- **Slots/children:** None
- **Conditional rendering:** Icon and label swap based on isMuted

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onToggle | `(authorId: string) => void` | Mute or unmute toggled |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Enter/Space | Toggle mute state |

### States
- **Default:** Button with current mute state
- **Loading:** Spinner replacing icon during API call
- **Disabled:** N/A
- **Error:** Sonner toast "Failed to update mute preference"
- **Success:** Sonner toast "Author muted" / "Author unmuted"

### Should Contain
- Toggle presentation
- Aria-label with author name

### Should NOT Contain
- Mute API call (parent handles)
- Feed re-filtering logic

### Reuse Notes
- Specific to feed module

---

## Component: ReportPostDialog

**Purpose:** Modal dialog for reporting a post
**Used In:** PostCard (action menu)
**WAI-ARIA Pattern:** alertdialog
**ARIA Pattern Reference:** https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/

### TypeScript Props Interface

```typescript
interface ReportPostDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Post ID being reported */
  postId: string;
  /** Callback fired on report submission */
  onSubmit: (postId: string, reason: string) => void;
  /** Callback fired on cancel/close */
  onClose: () => void;
  /** Whether report is being submitted */
  isSubmitting: boolean;
}
```

### Render Contract

- **Visual output:** Modal with reason textarea, submit and cancel buttons
- **Slots/children:** None
- **Conditional rendering:** Submit button disabled while isSubmitting

### Events / Callbacks

| Event | Payload Type | Description |
|---|---|---|
| onSubmit | `(postId: string, reason: string) => void` | Report submitted |
| onClose | `() => void` | Dialog dismissed |

### Keyboard Interaction Spec

| Key | Action |
|---|---|
| Tab | Move between reason field and buttons |
| Enter | Submit report (when button focused) |
| Escape | Close dialog |

### States
- **Default:** Open dialog with empty reason field
- **Loading:** Submit button spinner, fields disabled
- **Disabled:** N/A
- **Error:** "Failed to submit report" inline error
- **Success:** Dialog closes, sonner toast "Post reported"

### Should Contain
- Reason input
- Focus trap within dialog
- Return focus to trigger on close

### Should NOT Contain
- Report API call
- Moderation logic

### Reuse Notes
- Pattern reusable for any content reporting dialog (ads, jobs)
