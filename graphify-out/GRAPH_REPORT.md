# Graph Report - client  (2026-07-22)

## Corpus Check
- 392 files · ~236,582 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1397 nodes · 2719 edges · 201 communities (191 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `289f3b90`
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
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 130|Community 130]]
- [[_COMMUNITY_Community 155|Community 155]]
- [[_COMMUNITY_Community 156|Community 156]]
- [[_COMMUNITY_Community 157|Community 157]]
- [[_COMMUNITY_Community 158|Community 158]]
- [[_COMMUNITY_Community 159|Community 159]]
- [[_COMMUNITY_Community 160|Community 160]]
- [[_COMMUNITY_Community 161|Community 161]]
- [[_COMMUNITY_Community 162|Community 162]]
- [[_COMMUNITY_Community 163|Community 163]]
- [[_COMMUNITY_Community 164|Community 164]]
- [[_COMMUNITY_Community 165|Community 165]]
- [[_COMMUNITY_Community 166|Community 166]]
- [[_COMMUNITY_Community 167|Community 167]]
- [[_COMMUNITY_Community 168|Community 168]]
- [[_COMMUNITY_Community 169|Community 169]]
- [[_COMMUNITY_Community 171|Community 171]]
- [[_COMMUNITY_Community 172|Community 172]]
- [[_COMMUNITY_Community 173|Community 173]]
- [[_COMMUNITY_Community 174|Community 174]]
- [[_COMMUNITY_Community 175|Community 175]]
- [[_COMMUNITY_Community 176|Community 176]]
- [[_COMMUNITY_Community 177|Community 177]]
- [[_COMMUNITY_Community 178|Community 178]]
- [[_COMMUNITY_Community 179|Community 179]]
- [[_COMMUNITY_Community 180|Community 180]]
- [[_COMMUNITY_Community 181|Community 181]]
- [[_COMMUNITY_Community 182|Community 182]]
- [[_COMMUNITY_Community 183|Community 183]]
- [[_COMMUNITY_Community 184|Community 184]]
- [[_COMMUNITY_Community 185|Community 185]]
- [[_COMMUNITY_Community 186|Community 186]]
- [[_COMMUNITY_Community 187|Community 187]]
- [[_COMMUNITY_Community 188|Community 188]]
- [[_COMMUNITY_Community 198|Community 198]]
- [[_COMMUNITY_Community 199|Community 199]]

## God Nodes (most connected - your core abstractions)
1. `getErrorMessage()` - 108 edges
2. `formatCurrency()` - 60 edges
3. `badgeStyle()` - 38 edges
4. `getRoleCode()` - 38 edges
5. `masterConfigs` - 28 edges
6. `formatDate()` - 25 edges
7. `LeadWorkspacePage()` - 23 edges
8. `hasTaskPortalAccess()` - 22 edges
9. `usePagination()` - 20 edges
10. `badgeColors()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `AccountsDashboard()` --calls--> `getGreeting()`  [INFERRED]
  src/pages/portals/collection/AccountsDashboard.jsx → src/pages/dashboard/Dashboard.jsx
- `PortalWorkspaceShell()` --calls--> `getRoleCode()`  [EXTRACTED]
  src/pages/portals/common/PortalWorkspaceShell.jsx → src/utils/permissions.js
- `SalesHeadSiteVisits()` --calls--> `formatDate()`  [INFERRED]
  src/pages/portals/saleshead/SalesHeadSiteVisits.jsx → src/utils/formatters.js
- `SalesHeadTeamLeads()` --calls--> `formatDate()`  [INFERRED]
  src/pages/portals/saleshead/SalesHeadTeamLeads.jsx → src/utils/formatters.js
- `SalesManagerSiteVisits()` --calls--> `formatDate()`  [INFERRED]
  src/pages/portals/salesmanager/SalesManagerSiteVisits.jsx → src/utils/formatters.js

## Communities (201 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (18): AvailablePlotsModal(), CollectionDemandSchedule(), fmt(), CollectionOverdue(), fmt(), FILTERS, FinanceRevenue(), usePagination() (+10 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (10): customerTypeApi, motivationApi, statusRemarkApi, FACING_OPTIONS, TIMELINE_OPTIONS, DATE_FILTERS, getQuickFollowUpDate(), getQuickFollowUpForWeekday() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (41): buildDuplicateLeadInfo(), buildE164Phone(), buildNewLeadFollowUpShortcut(), COUNTRY_CODES, FOLLOW_UP_WORKSPACE_ROLES, followUpIsoToInputValue(), formatActivityDescription(), getActionByCode() (+33 more)

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (13): SidebarContext, ThemeContext, THEMES, API, DATE_FORMAT, PAGINATION, ROLE_CODES, ROLE_GROUPS (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (12): authApi, api, clearAuth(), failedQueue, refreshToken, setAuth(), token, followUpApi (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (37): browserslist, development, production, dependencies, axios, exceljs, @heroicons/react, html-to-image (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (23): RoleHomeRedirect(), ADMIN_ROLES, PORTAL_ROLE_MAP, PortalRoute(), RoleRoute(), buildOrganizationHeadSidebar(), TaskPortalLayout(), canAccessBookingApprovals() (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (10): autoCloseLabel(), cap(), emptyForm, fullName(), mmss(), needsFollowUp(), PRIORITIES, STATUS_LABELS (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.23
Nodes (5): CollectionBookings(), CollectionDashboard(), HandoffLeadsPage(), statusChipStyle(), badgeStyle()

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (11): bankApi, bookingCancelReasonApi, closedLostReasonApi, leadTypeApi, paymentModeApi, projectTypeApi, reallotmentRuleApi, scoreMasterApi (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (12): firstKey(), ReportBrowser(), fullName(), MODULE_TO_ROLE, PERIODS, ROLE_LABEL, ROLES, RollupTable() (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (14): compilerOptions, baseUrl, paths, exclude, include, @/*, @api/*, @assets/* (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (28): baseApi, inventoryUnitApi, projectPhaseApi, cancelBtn, closeBtn, deleteBtn, footer, header (+20 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (13): accountsManagerMenu, accountsManagerSidebar, accountsMenu, accountsSidebar, adminSidebar, collectionExecMenu, collectionExecSidebar, collectionSidebar (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (7): AGENT_ROLES, CallLogs(), EMPTY_FILTERS, selectStyle, STATUS_BADGE, td, th

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (13): asOptions(), commonSimpleColumns, loadDepartmentOptions(), loadLeadSourceOptions(), loadLeadStageOptions(), loadLeadStatusIdOptions(), loadLeadStatusOptions(), loadLocationOptions() (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.23
Nodes (8): getStoredScreen(), getWorkspaceBasePath(), getWorkspaceScreenStorageKey(), ICON_STYLE, PortalLayout(), SCREEN_TITLES, useWebSocket(), portalTaskMenuItem

### Community 21 - "Community 21"
Cohesion: 0.20
Nodes (6): collectionMenu, PortalWorkspaceShell(), roleConfigByCode, taskMenu, salesHeadMenu, salesManagerMenu

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (3): DATE_PRESETS, SalesHeadBookingSummary(), toDateStr()

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (6): locationApi, projectApi, AdminLeadManagement(), getTodayString(), STATUS_COLORS, cleanRepeatingLocation()

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (6): extends, rules, no-console, no-unused-vars, react-hooks/exhaustive-deps, react/prop-types

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (3): DATE_FILTER_OPTIONS, PIPELINE_COLUMNS, TelecallerPipeline()

### Community 27 - "Community 27"
Cohesion: 0.07
Nodes (13): AVATAR_COLORS, bookingByProject(), fullName(), hourLabel(), HOURS, num(), Panel(), pct() (+5 more)

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (6): telephonyApi, STATUS_BADGE, TABS, td, TelecallerCallLog(), th

### Community 29 - "Community 29"
Cohesion: 0.08
Nodes (25): paymentPlanApi, actionInitialState, followUpIsoToInputValue(), formatActivityDescription(), getActionByCode(), getFollowUpMinimumTime(), getQuickFollowUpDate(), getQuickFollowUpForWeekday() (+17 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (7): userApi, AGENT_ROLES, CallSettings(), inputStyle, labelStyle, td, th

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (12): bookingApi, bookingStatusApi, paymentStatusApi, sampleBooking, BOOKING_TABS, CATEGORY_COLORS, CATEGORY_LABELS, CollectionExecBookings() (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (4): AVATAR_COLORS, BOOKING_TABS, CollectionBookings(), getComputedTotalValue()

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (27): siteVisitApi, AGE_BRACKET_OPTIONS, DECISION_MAKER_OPTIONS, displayVisitDetailValue(), EMPTY_VISIT_DETAILS, hasVisitDetailsData(), normalizeVisitDetailsObject(), OPTIONAL_VISIT_DETAIL_KEYS (+19 more)

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (5): BREAKDOWN_ORDER, KPI_CARDS, STATUS_LABELS, TaskDashboard(), TaskWorkspace()

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (21): getAssigneeRoleForAction(), isRemarkMandatoryForAction(), LeadDetailsPage(), getAssigneeRoleForAction(), isRemarkMandatoryForAction(), LeadWorkspacePage(), isVisitDetailsComplete(), pickVisitDetails() (+13 more)

### Community 49 - "Community 49"
Cohesion: 0.18
Nodes (7): leadSourceApi, leadSubSourceApi, inputStyle, MarketingApiKeys(), selectStyle, td, th

### Community 50 - "Community 50"
Cohesion: 0.13
Nodes (11): paymentTypeApi, CollectionCustomerProfile(), CollectionPayments(), PAYMENT_MODES, PaymentDetailModal(), statusOf(), buildBookingSections(), dt() (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.11
Nodes (12): Avatar(), getInitials(), CATEGORY_COLORS, CATEGORY_LABELS, computeBudget(), emptyForm, PAYMENT_CATEGORIES, RecordPaymentModal() (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (13): leadWorkflowApi, DocumentManagement(), FinanceCollections(), PERIODS, td, th, RecordManagerBookings(), ROLE_LABELS (+5 more)

### Community 130 - "Community 130"
Cohesion: 0.10
Nodes (11): departmentApi, ASSIGN_OPTIONS, AVATAR_COLORS, Chip(), fuState(), GROUP_BY, OPTION_TOGGLES, PRIORITY_HEX (+3 more)

### Community 156 - "Community 156"
Cohesion: 0.05
Nodes (32): leadStageApi, leadStatusApi, whatsappCampaignApi, Campaigns(), EMPTY_FILTERS, inputStyle, labelStyle, selectStyle (+24 more)

### Community 157 - "Community 157"
Cohesion: 0.12
Nodes (15): attendanceApi, AttendancePage(), inputStyle, td, th, todayStr(), CheckInPage(), useAuthContext() (+7 more)

### Community 158 - "Community 158"
Cohesion: 0.29
Nodes (8): AVATAR_COLORS, BkdLedgerRow(), CollectionBookingDetail(), colorFor(), execName(), fmtD(), fmtFull(), initialsOf()

### Community 159 - "Community 159"
Cohesion: 0.16
Nodes (9): siteSettingsApi, Login(), PortalSidebar(), SiteSettingsContext, SiteSettingsProvider(), useSiteSettings(), LOGO_FIELDS, SiteSettings() (+1 more)

### Community 160 - "Community 160"
Cohesion: 0.16
Nodes (12): computeBookingTotals(), dropdownStyle, fmt(), GenerateBookingFormModal(), iconBtnStyle, inputStyle, labelStyle, SplitSection() (+4 more)

### Community 161 - "Community 161"
Cohesion: 0.67
Nodes (3): mmss(), S, VoiceNoteField()

### Community 162 - "Community 162"
Cohesion: 0.18
Nodes (7): DOC_TYPES, ProjectDocumentsPanel(), DOC_TYPES, fmtDate(), RecordManagerBookingDetail(), getFileMeta(), humanFileSize()

### Community 163 - "Community 163"
Cohesion: 0.19
Nodes (6): CollectionOpenBookings(), computedTotal(), toAmount(), CollectionReports(), fmt(), collectionMenu

### Community 164 - "Community 164"
Cohesion: 0.42
Nodes (11): callLead(), leadName(), leadPhone(), StatusChip(), useIsMobile(), SalesHeadDashboard(), SalesManagerDashboard(), isFollowUpMissed() (+3 more)

### Community 165 - "Community 165"
Cohesion: 0.15
Nodes (3): deepClone(), safeJsonParse(), safeJsonStringify()

### Community 166 - "Community 166"
Cohesion: 0.21
Nodes (10): axisTick, CallsPerDayLine(), ChartCard(), FunnelDonut(), HourlyCallsBar(), legendProps, num(), SalesFunnel() (+2 more)

### Community 167 - "Community 167"
Cohesion: 0.38
Nodes (12): AnalyticsDashboard(), addTableSheet(), autoWidth(), BLOCKS(), exportAnalytics(), exportPlainData(), fmtDate(), headerStyle() (+4 more)

### Community 168 - "Community 168"
Cohesion: 0.18
Nodes (7): CATEGORY_COLORS, CATEGORY_LABELS, CollectionExecBookingDetail(), fmtD(), getComputedTotalValue(), PAYMENT_CATEGORIES, QUICK_STATUS_CODES

### Community 169 - "Community 169"
Cohesion: 0.23
Nodes (10): COLORS, KPI_THEME, SERIES, STAGE_BG, STAGE_BORDER, STAGE_COLORS, stageBgFor(), stageBorderFor() (+2 more)

### Community 171 - "Community 171"
Cohesion: 0.29
Nodes (6): ICON_STYLE, UserMenu(), getSidebarMenuForRole(), getTaskMenuItem(), Sidebar(), logout

### Community 172 - "Community 172"
Cohesion: 0.18
Nodes (10): AuthContext, AuthProvider(), ChangePassword(), authSlice, changePassword, initialState, loadUser, normalizeUser() (+2 more)

### Community 173 - "Community 173"
Cohesion: 0.16
Nodes (9): AccountsDashboard(), dashboardApi, AccountsDashboard(), CollectionDashboard(), DATE_PRESETS, Dashboard(), getGreeting(), ICON_SIZE (+1 more)

### Community 174 - "Community 174"
Cohesion: 0.47
Nodes (5): DATE_FILTER_OPTIONS, formatSqft(), SalesHeadLeaderboardCard(), SalesManagerLeaderboardCard(), TelecallerLeaderboardCard()

### Community 175 - "Community 175"
Cohesion: 0.22
Nodes (6): SidebarProvider(), ThemeProvider(), rootReducer, store, uiSlice, root

### Community 176 - "Community 176"
Cohesion: 0.20
Nodes (7): marketingAllocationRuleApi, EMPTY_FORM, inputStyle, labelStyle, MarketingAllocationRules(), td, th

### Community 177 - "Community 177"
Cohesion: 0.49
Nodes (7): AuthedAudio(), AuthedImage(), API_ORIGIN, downloadAuthedFile(), getAuthedBlobUrl(), isAuthedApiUrl(), resolveLegacyHref()

### Community 178 - "Community 178"
Cohesion: 0.20
Nodes (6): EMPTY_FILTERS, OUTCOME_BADGE, ReallotmentLogList(), td, th, TRIGGER_LABEL

### Community 179 - "Community 179"
Cohesion: 0.20
Nodes (7): CALL_STATUS_BADGE, CallAllocationHistory(), EMPTY_FILTERS, OUTCOME_BADGE, selectStyle, td, th

### Community 180 - "Community 180"
Cohesion: 0.20
Nodes (6): DidNumberRules(), EMPTY_FORM, inputStyle, labelStyle, td, th

### Community 181 - "Community 181"
Cohesion: 0.29
Nodes (5): SELF_REPORT_GROUPS, selfFirstKey(), reportApi, PERIODS, PortalReports()

### Community 182 - "Community 182"
Cohesion: 0.25
Nodes (5): DOC_TYPES, DocumentArchive(), TaskListPage(), openAttachment(), openAuthedFile()

### Community 183 - "Community 183"
Cohesion: 0.22
Nodes (6): EMPTY_FILTERS, MarketingAllocationHistory(), OUTCOME_BADGE, selectStyle, td, th

### Community 184 - "Community 184"
Cohesion: 0.29
Nodes (7): ACCEPTANCE_STATUS_TEXT, BADGE_PALETTE, badgeTextColor(), CANON, normalizeHex(), TASK_STATUS_TEXT, TRANSACTION_STATUS_TEXT

### Community 185 - "Community 185"
Cohesion: 0.48
Nodes (5): AccountsVerifyPayments(), fmt(), fmtDate(), isCashPayment(), isVerifiedPayment()

### Community 186 - "Community 186"
Cohesion: 0.29
Nodes (3): taskApi, BREAKDOWN_ORDER, STATUS_LABELS

### Community 187 - "Community 187"
Cohesion: 0.43
Nodes (5): buildDefaultExportName(), createBlobAndDownload(), exportCsv(), exportJson(), toCsv()

### Community 188 - "Community 188"
Cohesion: 0.53
Nodes (4): AccountsVerifyPayments(), fmt(), fmtDate(), isVerifiedPayment()

## Knowledge Gaps
- **349 isolated node(s):** `extends`, `no-unused-vars`, `no-console`, `react/prop-types`, `react-hooks/exhaustive-deps` (+344 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** - run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getErrorMessage()` connect `Community 52` to `Community 0`, `Community 1`, `Community 2`, `Community 8`, `Community 13`, `Community 15`, `Community 156`, `Community 23`, `Community 26`, `Community 28`, `Community 29`, `Community 157`, `Community 158`, `Community 32`, `Community 31`, `Community 162`, `Community 163`, `Community 164`, `Community 165`, `Community 37`, `Community 30`, `Community 168`, `Community 42`, `Community 173`, `Community 174`, `Community 176`, `Community 49`, `Community 50`, `Community 51`, `Community 178`, `Community 179`, `Community 182`, `Community 183`, `Community 180`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `formatCurrency()` connect `Community 0` to `Community 32`, `Community 2`, `Community 163`, `Community 164`, `Community 8`, `Community 168`, `Community 42`, `Community 11`, `Community 173`, `Community 50`, `Community 51`, `Community 52`, `Community 185`, `Community 27`, `Community 188`, `Community 29`, `Community 158`, `Community 31`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `getRoleCode()` connect `Community 6` to `Community 1`, `Community 164`, `Community 40`, `Community 10`, `Community 171`, `Community 42`, `Community 173`, `Community 19`, `Community 21`, `Community 157`, `Community 29`, `Community 158`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `extends`, `no-unused-vars`, `no-console` to the rest of the system?**
  _349 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12183908045977011 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._