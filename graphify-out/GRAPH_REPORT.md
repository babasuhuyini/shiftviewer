# Graph Report - Shift management system  (2026-11-07)

## Corpus Check
- Corpus is ~28,954 words - fits in a single context window. You may not need a graph.

## Summary
- 451 nodes · 1444 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.86)
- Token cost: 52,061 input · 0 output

## Community Hubs (Navigation)
- Import Wizard & Code Mapping
- App Routing, Storage & Views
- File Format Readers
- Layout Detection Step
- Package Dependencies
- Dates & Shift Display
- Icons & Welcome Messages
- GitHub Pages Deploy
- Page Shell & Privacy
- TypeScript Config
- Import Flow Concepts
- Roster Selectors & Views

## God Nodes (most connected - your core abstractions)
1. `Dashboard()` - 46 edges
2. `Svg()` - 28 edges
3. `ImportWizard()` - 26 edges
4. `DayView()` - 22 edges
5. `detectGrid()` - 21 edges
6. `Callout()` - 20 edges
7. `StepLayout()` - 20 edges
8. `App()` - 18 edges
9. `ImportError` - 18 edges
10. `RawTable` - 16 edges

## Surprising Connections (you probably didn't know these)
- `interpret()` --calls--> `detectGrid()`  [EXTRACTED]
  tests/core.test.ts → src/lib/interpret/layout.ts
- `interpret()` --calls--> `detectGrid()`  [EXTRACTED]
  tests/local-sample.test.ts → src/lib/interpret/layout.ts
- `pdfExtraction()` --calls--> `pageToTable()`  [EXTRACTED]
  tests/local-sample.test.ts → src/lib/parse/pdfGrid.ts
- `WizardProps` --references--> `Roster`  [EXTRACTED]
  src/import/ImportWizard.tsx → src/lib/types.ts
- `interpret()` --calls--> `buildRoster()`  [EXTRACTED]
  tests/local-sample.test.ts → src/lib/interpret/build.ts

## Import Cycles
- 2-file cycle: `src/views/Agenda.tsx -> src/views/Dashboard.tsx -> src/views/Agenda.tsx`

## Hyperedges (group relationships)
- **Import Wizard Step Sequence** — readme_content_based_format_detection, readme_layout_check, readme_spaced_leave_word_detection, readme_shift_code_confirmation, readme_review_step [EXTRACTED 1.00]
- **Privacy Safeguards** — readme_csp_connect_src_none, readme_indexeddb_roster_storage, readme_localstorage_name_and_codes, readme_remove_roster_from_device, readme_gitignore_roster_files, index_privacy_meta_tags [INFERRED 0.85]

## Communities (12 total, 1 thin omitted)

### Community 0 - "Import Wizard & Code Mapping"
Cohesion: 0.06
Nodes (63): ImportWizard(), accept(), continueFromLayout(), handleFile(), prepareCodes(), selectTable(), Step, STEP_LABELS (+55 more)

### Community 1 - "App Routing, Storage & Views"
Cohesion: 0.10
Nodes (45): react, App(), navigate(), parseHash(), Route, useRoute(), Avatar(), AvatarStack() (+37 more)

### Community 2 - "File Format Readers"
Cohesion: 0.09
Nodes (44): jszip@^3.10.1, jszip, isValidYMD(), parseDayNumber(), decode(), readCsv(), attr(), child() (+36 more)

### Community 3 - "Layout Detection Step"
Cohesion: 0.11
Nodes (48): CheckIcon(), Callout(), Segmented(), defaultList(), emptyGrid(), ListControls(), Preview(), Props (+40 more)

### Community 4 - "Package Dependencies"
Cohesion: 0.06
Nodes (42): dependencies, @fontsource-variable/fraunces@^5.2.8, papaparse@^5.5.3, pdfjs-dist@^5.3.31, react@^19.1.0, react-dom@^19.1.0, xlsx@https://cdn.sheetjs.com/xlsx-0.20.3/x..., description (+34 more)

### Community 5 - "Dates & Shift Display"
Cohesion: 0.17
Nodes (39): ChevronRight(), CodeLegend(), overnightNote(), ShiftChip(), ShiftLike, timeRange(), StepReview(), addDays() (+31 more)

### Community 6 - "Icons & Welcome Messages"
Cohesion: 0.13
Nodes (33): AlertIcon(), CalendarIcon(), ClockIcon(), CloseIcon(), DashIcon(), HeartIcon(), InfoIcon(), ListIcon() (+25 more)

### Community 7 - "GitHub Pages Deploy"
Cohesion: 0.06
Nodes (32): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+24 more)

### Community 8 - "Page Shell & Privacy"
Cohesion: 0.15
Nodes (14): index.html App Shell, Inline SVG Heart Favicon, /src/main.tsx Module Entry, noscript JavaScript-Required Notice, Privacy Meta Tags (no-referrer, noindex/nofollow), #root Mount Element, Light/Dark theme-color Meta, Content Security Policy connect-src 'none' (+6 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.12
Nodes (16): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 10 - "Import Flow Concepts"
Cohesion: 0.29
Nodes (9): Content-Based File Format Detection, Roster Import Flow (Wizard), Layout Check (Names-Down/Dates-Across vs One-Row-Per-Shift), Import Review Step (Totals, Warnings, Side-by-Side Compare), Shift Code Confirmation, Spaced Leave-Word Detection (A N N U A L), src/import (Import Wizard Steps), src/lib/interpret (Layout, Draft, Leave, Codes, Final Roster) (+1 more)

## Knowledge Gaps
- **9 isolated node(s):** `Local Real-Roster Sample Test (tests/local-sample.test.ts)`, `Import Review Step (Totals, Warnings, Side-by-Side Compare)`, `src/lib/roster.ts (Selectors)`, `src/import (Import Wizard Steps)`, `src/views (Dashboard, Calendar, Agenda, Day View, Name Picker, Roster Info)` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 98 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App Routing, Storage & Views` to `Import Wizard & Code Mapping`, `Package Dependencies`, `Dates & Shift Display`, `Icons & Welcome Messages`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `Local Real-Roster Sample Test (tests/local-sample.test.ts)`, `Import Review Step (Totals, Warnings, Side-by-Side Compare)`, `src/lib/roster.ts (Selectors)` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Import Wizard & Code Mapping` be split into smaller, more focused modules?**
  _Cohesion score 0.05886075949367089 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Package Dependencies` to `Import Wizard & Code Mapping`, `Icons & Welcome Messages`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `App Routing, Storage & Views` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Why does `jszip` connect `File Format Readers` to `Import Wizard & Code Mapping`, `Package Dependencies`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `File Format Readers` be split into smaller, more focused modules?**
  _Cohesion score 0.0899854862119013 - nodes in this community are weakly interconnected._