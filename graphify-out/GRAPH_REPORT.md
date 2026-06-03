# Graph Report - client  (2026-06-03)

## Corpus Check
- 304 files · ~134,738 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 836 nodes · 1481 edges · 156 communities (143 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `742e2c2b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 155|Community 155]]

## God Nodes (most connected - your core abstractions)
1. `getErrorMessage()` - 51 edges
2. `formatCurrency()` - 42 edges
3. `getRoleCode()` - 28 edges
4. `masterConfigs` - 25 edges
5. `formatDate()` - 20 edges
6. `LeadWorkspacePage()` - 19 edges
7. `formatDateTime()` - 18 edges
8. `hasTaskPortalAccess()` - 16 edges
9. `LeadDetailsPage()` - 13 edges
10. `paths` - 10 edges

## Surprising Connections (you probably didn't know these)
- `AccountsDashboard()` --calls--> `getGreeting()`  [INFERRED]
  src/pages/portals/accounts/AccountsDashboard.jsx → src/pages/dashboard/Dashboard.jsx
- `AccountsDashboard()` --calls--> `getGreeting()`  [INFERRED]
  src/pages/portals/collection/AccountsDashboard.jsx → src/pages/dashboard/Dashboard.jsx
- `CollectionDashboard()` --calls--> `getGreeting()`  [INFERRED]
  src/pages/portals/collection/CollectionDashboard.jsx → src/pages/dashboard/Dashboard.jsx
- `CollectionBookings()` --calls--> `formatCurrency()`  [EXTRACTED]
  src/pages/portals/collection/CollectionComponents.jsx → src/utils/formatters.js
- `PortalWorkspaceShell()` --calls--> `getRoleCode()`  [EXTRACTED]
  src/pages/portals/common/PortalWorkspaceShell.jsx → src/utils/permissions.js

## Communities (156 total, 13 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (53): AccountsDashboard(), AccountsVerifyPayments(), fmt(), fmtDate(), isVerifiedPayment(), bookingApi, bookingStatusApi, dashboardApi (+45 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (54): customerTypeApi, leadWorkflowApi, motivationApi, projectApi, siteVisitApi, statusRemarkApi, actionInitialState, followUpIsoToInputValue() (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (47): buildDuplicateLeadInfo(), buildE164Phone(), buildNewLeadFollowUpShortcut(), COUNTRY_CODES, FOLLOW_UP_WORKSPACE_ROLES, followUpIsoToInputValue(), formatActivityDescription(), getActionByCode() (+39 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (25): notificationApi, SidebarContext, SidebarProvider(), ThemeContext, ThemeProvider(), THEMES, useThemeContext(), Header() (+17 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (23): authApi, api, clearAuth(), failedQueue, refreshToken, setAuth(), token, followUpApi (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (30): browserslist, development, production, dependencies, axios, @heroicons/react, libphonenumber-js, react (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (22): AccountsDashboard(), Dashboard(), getGreeting(), ICON_SIZE, ICON_SM, TaskAccessRoute(), BREAKDOWN_ORDER, STATUS_LABELS (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (12): departmentApi, subDepartmentApi, taskApi, STATUS_LABELS, STATUS_LABELS, cap(), emptyForm, fullName() (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (12): CollectionBookings(), CollectionDashboard(), AdminLeadManagement(), getTodayString(), STATUS_COLORS, TelecallerPullRequests(), buildDefaultExportName(), createBlobAndDownload() (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (9): bankApi, bookingCancelReasonApi, closedLostReasonApi, leadStageApi, leadStatusApi, paymentModeApi, paymentPlanApi, projectTypeApi (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (10): reportApi, fullName(), InventoryReport(), PERIODS, ROLES, RollupTable(), td, th (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (14): compilerOptions, baseUrl, paths, exclude, include, @/*, @api/*, @assets/* (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.16
Nodes (7): baseApi, inventoryUnitApi, locationApi, projectPhaseApi, EMPTY_FORM, formatCurrency(), InventoryUnitList()

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (11): accountsSidebar, adminSidebar, collectionMenu, collectionSidebar, getSidebarMenuForRole(), getTaskMenuItem(), ROLE_LABELS, salesHeadSidebar (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.19
Nodes (11): leadSubSourceApi, ALLOWED_STATUS_CODES, FULL_DETAIL_STATUS_CODES, getQuickFollowUpForWeekday(), getQuickFollowUpValue(), getStatusCode(), hasValidPhoneLength(), initialForm (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.30
Nodes (11): asOptions(), commonSimpleColumns, loadDepartmentOptions(), loadLeadSourceOptions(), loadLeadStageOptions(), loadLeadStatusIdOptions(), loadLeadStatusOptions(), loadLocationOptions() (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.22
Nodes (5): ICON_STYLE, PortalLayout(), SCREEN_TITLES, useWebSocket(), portalTaskMenuItem

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (5): collectionMenu, PortalWorkspaceShell(), roleConfigByCode, taskMenu, salesManagerMenu

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (3): DATE_PRESETS, SalesHeadBookingSummary(), toDateStr()

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (6): extends, rules, no-console, no-unused-vars, react-hooks/exhaustive-deps, react/prop-types

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (3): DATE_FILTER_OPTIONS, PIPELINE_COLUMNS, TelecallerPipeline()

## Knowledge Gaps
- **169 isolated node(s):** `extends`, `no-unused-vars`, `no-console`, `react/prop-types`, `react-hooks/exhaustive-deps` (+164 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getErrorMessage()` connect `Community 0` to `Community 1`, `Community 2`, `Community 8`, `Community 15`, `Community 23`, `Community 26`, `Community 29`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `formatCurrency()` connect `Community 0` to `Community 1`, `Community 2`, `Community 6`, `Community 8`, `Community 11`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `getRoleCode()` connect `Community 6` to `Community 0`, `Community 1`, `Community 10`, `Community 14`, `Community 19`, `Community 21`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `formatDate()` (e.g. with `SalesHeadSiteVisits()` and `SalesHeadTeamLeads()`) actually correct?**
  _`formatDate()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `extends`, `no-unused-vars`, `no-console` to the rest of the system?**
  _169 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05022404779686333 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05258033106134372 - nodes in this community are weakly interconnected._