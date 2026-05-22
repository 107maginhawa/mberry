# Landing Page

- **Route:** `/`
- **Module:** M01 Auth & Onboarding (growth entry point)
- **Access:** Public
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Convert prospective officers and members into signups by communicating Memberry's value proposition and directing them to the appropriate registration or onboarding starting point.

## Layout

### Desktop
Full-viewport marketing page with a fixed top navigation bar. Nav contains: platform logo (left), primary CTA "Get Started" button (right), and "Log In" text link (right, secondary). Content is divided into sequential sections scrolling vertically: Hero section, Value proposition / feature highlights, Social proof, and a bottom CTA section. Max content width ~1200px, centered. Footer with legal links.

### Mobile
Fixed top nav collapses to logo + hamburger menu; hamburger reveals "Get Started" and "Log In" links in a slide-down drawer. Hero section stacks headline, subtext, and CTA button vertically at full width. Feature highlights reflow from a multi-column grid to a single-column stacked list. Social proof section condenses to a horizontal scroll of cards. Bottom CTA and footer are identical in structure to desktop, full-width.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Top navigation | nav | Fixed position; platform logo links to `/`; "Get Started" primary button links to `/register`; "Log In" text link links to `/login` |
| Hero headline | text | Primary value proposition headline (large display type) |
| Hero subtext | text | One to two sentences expanding on the headline |
| Hero CTA button | button (primary) | "Get Started" — links to `/register`; the primary conversion action on the page |
| Feature highlight cards | card grid | Visual blocks describing key capabilities (dues collection, roster management, member self-service, etc.); icon + heading + one-line description per card |
| Social proof section | card list | Testimonials or org names/logos using the platform |
| Bottom CTA section | banner | "Ready to get started?" headline + "Get Started" button (same destination as hero CTA) + secondary "Log In" link |
| Footer | footer | Links: Privacy Policy, Terms of Service, Contact; copyright notice |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Initial page load | Page renders server-side; no loading spinner visible to user; images lazy-load with placeholder backgrounds |
| Authenticated visitor | Logged-in user navigates to `/` | Top nav replaces "Get Started" and "Log In" with "Go to Dashboard" button; clicking navigates to the user's dashboard. Page content remains the same — no redirect. |
| Error: Page failed to load | CDN or server error | Standard error page with "Try refreshing" message; no app chrome required |

## Interactions

- All "Get Started" CTAs on the page link to `/register` with no query params — org context is added only when arriving from an org public page.
- "Log In" link in the nav and footer links to `/login`.
- Clicking the platform logo in the nav always navigates to `/` (useful when user has scrolled down).
- The page is SEO-optimized: server-rendered HTML, meta title/description, and Open Graph tags for link sharing.
- Org public pages (`/org/[slug]`) each have their own "Apply to Join" CTA; the landing page is org-agnostic and targets officers setting up new chapters as the primary conversion.
- Mobile hamburger menu closes when any link within it is tapped.
