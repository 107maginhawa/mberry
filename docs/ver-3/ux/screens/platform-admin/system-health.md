# System Health

- **Route:** `/admin/system/health`
- **Module:** M03 Platform Admin
- **Access:** Platform Admin (Super)
- **Phase:** 1
- **Desktop:** ✓ | **Mobile:** —

## Purpose

Give Super Admins a real-time view of platform infrastructure health — service status, background job queues, error rates, and database connectivity — to detect and respond to incidents.

## Layout

Full-width status dashboard. The page is organized into three horizontal sections stacked vertically: (1) an overall status banner at the top, (2) a service status grid in the middle, and (3) background job and queue tables at the bottom. The page auto-refreshes every 30 seconds; a last-updated timestamp is visible. No left sidebar.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Overall status banner | Full-width banner | "All systems operational" (green) — or — "Degraded performance detected" (amber) — or — "Service outage in progress" (red). Auto-calculated from the worst status among all individual services. |
| Last updated timestamp | Small text | "Last updated: [time]" with a manual "Refresh now" link. |
| Service status grid | Grid of status cards | One card per service: API Server, Database (PostgreSQL), Background Job Worker, Email Delivery (SMTP), Payment Gateway, File Storage, Search Index. Each card: service name, status indicator (Operational / Degraded / Down), response time (ms), uptime % (last 30 days). |
| Status indicator | Colored dot + label | Green = Operational, amber = Degraded, red = Down. |
| Response time sparkline | Mini chart | Last 60-minute response time trend within the service card. |
| Background job queue table | Table | Columns: Queue Name (e.g., "email-notifications," "billing-retry," "health-score-recalculation"), Pending Jobs, Processing Jobs, Failed Jobs (last 24 hrs), Last Processed At. Failed job count > 0 shown in amber; > 10 shown in red. |
| "View failed jobs" | Inline link | Opens a filtered view of the failed job log for that queue. |
| Error rate panel | Time series chart | API error rate (4xx and 5xx) over the last 24 hours. Horizontal axis: time. Vertical axis: error rate %. Threshold lines at 1% (amber) and 5% (red). |
| Recent incidents | Collapsible list | Last 5 incidents or service degradation events, with timestamps, affected services, and resolution status. |
| Manual refresh | Button | "Refresh now" forces an immediate data reload. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Spinner per service card. Banner shows "Checking system status..." |
| All operational | All services reporting healthy | Overall banner is green: "All systems operational." All service cards show green indicators. |
| Degraded | One or more services degraded | Overall banner is amber. Affected service cards highlighted with amber border. |
| Outage | One or more services down | Overall banner is red. Affected service cards show red "Down" status and turn red-bordered. |
| High failed jobs | Any queue has > 10 failed jobs | That queue row turns red. A note appears at the top of the jobs table: "High failure rate detected in [queue]. Immediate attention required." |
| Stale data | Auto-refresh fails (network issue) | "Last updated" timestamp turns amber. Banner: "Unable to refresh — displaying data from [N] minutes ago. Check your connection." |
| Error | Full page data fetch fails | "System health data could not be loaded. Retry." with retry button. |

## Interactions

- The page auto-refreshes every 30 seconds. A countdown indicator next to the timestamp shows time to next refresh.
- "Refresh now" resets the countdown and triggers an immediate data reload.
- Each service card is non-interactive (display only). Future phases may add per-service restart triggers for on-call engineers.
- "View failed jobs" opens a modal or navigates to a filtered log view showing the stack traces and payloads of the failed jobs in that queue.
- The error rate chart is zoomable (click and drag to select a time window); double-click resets the zoom.
- This page does not serve as a public status page. It is for internal operators only. A separate member-facing status page (if implemented) is not part of this screen.
