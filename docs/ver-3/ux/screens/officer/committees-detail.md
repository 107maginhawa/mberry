# Committee Detail

- **Route:** `/org/[id]/officer/committees/[id]`
- **Module:** M19 Committee Management
- **Access:** President (full management); Chairperson and committee members (view + limited edit)
- **Phase:** 3
- **Desktop:** ✓ | **Mobile:** ✓

## Purpose

Central hub for a single committee — showing its purpose, membership, term, and status, with navigation to its meetings, tasks, and reports, plus management actions available to the President and Chairperson.

## Layout

### Desktop
Sidebar with Committees active. Main content has a two-column layout: left (65%) for the committee overview (purpose, members list, recent activity), right (35%) for the meta panel (type, term dates, status, chairperson). A tab bar below the header provides navigation to Meetings and Tasks sub-pages. A Reports section is embedded in the overview or accessible via a fourth tab.

### Mobile
Single-column layout. Meta panel at top (collapsed card, expandable). Tab bar for Meetings and Tasks below the meta panel. Members list and reports below.

## Components

| Component | Type | Description |
|-----------|------|-------------|
| Committee header | Title block | Committee name, type badge, status badge. Edit icon (pencil) for President and Chairperson. |
| Purpose / description | Text block | Free text description of the committee's mandate. Editable by President or Chairperson. |
| Meta panel | Info block | Type, status, term start, term end, days remaining in term, chairperson name. |
| Members list | List | Each member: name, role (Chairperson or Member), joined date. Add / Remove member actions. |
| Add Member button | Secondary button | Opens member search/select modal. Must be an active org member. Available to Chairperson and President. |
| Remove Member button | Destructive icon button | Per member row. Confirmation required. Not available for the Chairperson row (only President can remove/replace chairperson). |
| Change Chairperson button | Secondary button | President only. Replaces the current chairperson with a new member selection. |
| Sub-page tab bar | Horizontal tabs | Meetings | Tasks | Reports |
| Reports section | List of report cards | Each report: title, status (draft / submitted / reviewed), submitted date, file attachment link. |
| Submit Report button | Secondary button | Chairperson only. Opens the report submission form: title, free text body, optional file attachments (PDF or images). |
| Dissolve Committee button | Destructive button | President only. Opens a confirmation dialog before marking the committee as Completed. |
| Renew Term button | Secondary button | President only. Available for Standing committees when term end is within 30 days. Opens date picker for new term end date. |

## States

| State | Trigger | Behavior |
|-------|---------|----------|
| Loading | Page load | Skeleton for meta panel and members list. |
| Active committee | Status is Active | All management actions available per role. |
| Near term end | Term ends within 30 days | Amber warning in meta panel: "Term ends in X days." Renew Term button shown for Standing committees. |
| Completed committee | Term expired or President dissolved | Full read-only view. No add/remove members, no schedule meeting, no create task. A banner reads: "This committee's term has ended. Historical data is retained for reference." Dissolve and Renew buttons removed. |
| No members | Committee created with no members yet | Empty state in members list: "No members added yet. Add members to get started." |
| No reports | No reports submitted | Empty state in Reports tab: "No reports submitted yet." |
| Report submitted | Chairperson submits a report | Toast: "Report submitted." Report appears in the list with status "Submitted." President is notified via M07. |
| President reviews report | President marks report as reviewed | Report status changes to "Reviewed." Timestamp added. |

## Interactions

- Editing the committee name, purpose, or term dates: President clicks the edit icon in the header. An inline edit form appears. Save and Cancel buttons appear. Changes take effect on Save.
- Adding a member: searching by name shows a typeahead list of active org members who are not already in this committee. Selection adds them immediately with role = Member.
- The Chairperson role within the committee is separate from officer roles at the org level. A committee chairperson does not need to be an org officer.
- Dissolve Committee confirmation dialog: "Dissolve [Name]? The committee will be marked as Completed. Members will lose active access. All historical data (meetings, tasks, reports) is retained." Two buttons: "Dissolve Committee" (destructive) and "Cancel."
- For Special committees, the committee detail page is only visible to the President and to members of that committee. Other officers who navigate to the URL receive a 403.
- Reports tab: the President sees all submitted reports with the ability to mark each "Reviewed." The Chairperson sees all reports and the Submit Report button. Committee members see submitted reports but cannot submit or mark reviewed.
- Renewing a term updates the term_end date and keeps the committee status as Active. No new committee record is created — it is an in-place update with an audit log entry.
