# Platform Dashboard

- **Route:** `/admin`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (all roles)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give Memberry operators an at-a-glance view of everything that needs their attention right now, prioritizing actionable items over vanity metrics.

## Layout

Full-width page with no left sidebar. Top section is a horizontal row of actionable item cards sorted by urgency — each card surfaces a count and links directly to the relevant management screen with pre-applied filters. Below the actionable row is a secondary metrics strip showing platform-wide totals. The bottom third of the page is a recent activity feed showing the last 10 significant platform events in reverse chronological order.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Actionable card: Pending Setup | Alert card | "N associations pending setup" — count of associations created but wizard not started. Links to `/admin/associations?status=pending`. |
| Actionable card: Support Tickets | Alert card | "N support tickets (M approaching SLA)" — open ticket count with SLA urgency sub-count in amber. Links to `/admin/support`. |
| Actionable card: Payment Failures | Alert card | "N payment failures this week" — failed subscription billing events. Links to `/admin/associations?billing=failed`. |
| Actionable card: Expiring Trials | Alert card | "N trials expiring this week" — org trials ending within 7 days. Links to `/admin/associations?trial=expiring`. |
| Actionable card: Feature Rollout | Alert card | "Feature rollout: [module] at N% of [tier] orgs" — shows the most recent flag change in progress. Links to `/admin/feature-flags`. |
| Data breach alert | Alert card (red) | "DATA BREACH: NPC notification deadline approaching — [time remaining]." Shown only when a breach report is active. Links to the breach workflow. |
| Stat card: Total Associations | Metric display | Number with a trend arrow (up/down vs. prior month). Non-interactive. |
| Stat card: Total Orgs | Metric display | Total active organizations across all associations. |
| Stat card: Total Members | Metric display | Cumulative member count across all orgs. |
| Stat card: MRR | Metric display | Monthly recurring revenue in platform currency, formatted with currency symbol. |
| Activity feed | List | Last 10 significant events (new org created, subscription converted, ticket resolved, flag changed). Each item is timestamped and links to its detail page. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton cards for actionable row and stat strip; feed shows a spinner. |
| All clear | No actionable items exist | Actionable row replaced by a single full-width message: "All clear — no items requiring attention right now." Stat cards and activity feed displayed more prominently. |
| Partial load error | One or more data sources fail | Banner: "Some dashboard data could not be loaded. Refresh to try again." Successfully loaded sections remain visible. |
| Breach active | Active BreachReport with NPC deadline approaching | Red breach alert card inserted as the first card in the actionable row, overriding sort order. |

## Interactions

- Clicking any actionable card navigates to the relevant management page with the described query parameters pre-applied as active filters.
- Stat cards are display-only; no click interaction.
- Activity feed items are individually linked: clicking an item navigates to its detail page (e.g., the org that was created, the ticket that was resolved).
- Cards are sorted by urgency automatically — breach alerts always first, then SLA-breaching tickets, then others.
