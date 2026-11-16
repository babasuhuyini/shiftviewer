# ShiftViewer: Complete Product Audit, Redesign, Document Upload, Analytics, and Feedback

## Project context

I built ShiftViewer for my wife and she has shared it with colleagues: https://babasuhuyini.github.io/shiftviewer/

Some colleagues have saved it as a web app on their phones. The design does not feel quite right. The app also appears to accept DOCX files only; uploading another extension produces an error. I want to improve usability, visual design, accessibility, responsiveness, and reliability; support suitable formats beyond DOCX; understand aggregate usage; and collect occasional user feedback.

## Your role

Act as a senior product team combining a creative director, UI/UX and accessibility specialist, front-end/application architect, document-processing specialist, security/privacy reviewer, performance/reliability engineer, and product analytics/feedback specialist.

Fit recommendations to the actual app, users, source, deployment method, and hosting constraints. Keep the experience simple for non-technical users.

## Working rules

1. Start with a read-only audit. Do not edit code, design files, configuration, dependencies, deployment settings, or deployed content during the audit.
2. Inspect the live app and source project that I provide or make available. Do not assume the framework, hosting setup, architecture, libraries, or cause of any behavior.
3. Separate verified findings, hypotheses, and recommendations. Cite relevant screens, files, functions, or observed behavior.
4. If you cannot access the app or source, say so; continue only with what you can verify and list the evidence needed for the rest.
5. Before implementation, present a prioritized proposal with benefits, risks, effort, dependencies, privacy implications, expected costs, and decisions needed.
6. Stop and wait for my explicit approval of the proposed scope.
7. After approval, make a reversible backup or branch before editing.
8. Do not deploy, publish, overwrite, or change the live version without separate explicit approval after I review the work.
9. Do not add third-party services, transmit data, or create accounts without explaining the specific data flow and getting my approval.
10. Explain the purpose, maintenance impact, privacy implications, and cost of proposed dependencies or services.
11. Never send uploaded documents or their contents to analytics or feedback providers.
12. Never claim a security review proves the app is secure. Explain what was tested and the review’s limits.

## Phase 1 — Inspect and map the product

Record what you could actually access: live app, source repository/local files, browser tools, build/deployment configuration; framework/runtime/build tool/hosting/deployment path if discoverable; main screens and user journeys; current upload, validation, parsing, and error flow; existing dependencies and whether document contents are processed locally or remotely; analytics, feedback, storage, cookies, and privacy notices; PWA manifest/service worker and install behavior if present; hosting constraints.

Do not infer usage numbers from source code or repository traffic. Do not assume a saved web app can report installs or identify a person.

## Phase 2 — Audit before proposing changes

### Usability and creative direction

Review whether the purpose and next action are clear; navigation, labels, and user flows; hierarchy; typography, spacing, grid, colors, contrast, and component consistency; whether the design feels intentional and appropriate; upload, processing, results, and error recovery; button feedback and affordances; empty/loading/success/partial-success/failure states; scanability; generic, repetitive, decorative, or “AI-generated-looking” patterns that weaken clarity; and ways to make the product more personal and trustworthy without clutter.

For every issue, describe the observed problem, user impact, and concrete improvement. Avoid vague advice such as “make it modern.”

### Accessibility and responsive behavior

Check keyboard-only use and visible focus; semantic headings, landmarks, labels, buttons; screen-reader names and announcements for upload/progress/errors/results; contrast and color-independent meaning; text scaling, zoom, reduced motion; file-picker and drag-and-drop alternatives; actionable errors; and narrow mobile, tablet, and desktop layouts. Look for overflow, clipping, small tap targets, dense controls, mobile navigation, readability, long filenames/results, and layout shifts. State what you actually tested and what remains untested; tie recommendations to observed screens and breakpoints.

### Reliability, security, and performance

Inspect actual code and behavior for file validation/parser failures; malformed, encrypted, empty, oversized, or corrupt files; preservation of work and recovery; unsafe HTML rendering, injection, unsafe filenames; visible dependency/configuration risks; exposure of document contents in storage, logs, or third-party services; resource exhaustion; local versus remote processing; initial load/assets/bundle size; unnecessary dependencies; parse time/memory; responsiveness with large files; repeated work; layout shifts.

Prioritize security/reliability findings by likelihood and impact, cite evidence, and explain limits. Recommend performance changes only when supported by evidence.

### Search and metadata

First determine whether public search discovery matters for this utility. If so, review title, description, social metadata, semantics, and indexing. If not, focus on appropriate privacy and indexing choices rather than irrelevant SEO work.

## Phase 3 — Diagnose DOCX-only behavior

Trace the upload path end to end. Determine accepted extensions, MIME types, and file signatures; whether the restriction is in the picker, validation, parser, or later processing; what happens for PDF/other formats; whether parsing relies on DOCX structure or particular fields; whether renaming bypasses validation; and whether errors accurately explain the limitation.

Explain the confirmed cause with file/function references. If source is unavailable, label causes as hypotheses and list the files/access needed to confirm them.

## Phase 4 — Propose a safe document-ingestion pipeline

Do not assume every file should be converted to DOCX. Prefer extracting needed information into a stable internal representation and passing that to existing shift-reading logic. Preserve the original only when useful.

Consider formats only where appropriate:

- DOCX: extract text and useful structure; preserve headings/tables where needed.
- Text-based PDF: extract directly where reliable; preserve page order and table structure as feasible.
- Scanned/image-only PDF: offer OCR only when necessary. Explain local versus remote OCR, accuracy limits, privacy, language support, and performance. Any external transmission needs my approval.
- TXT: handle text and encoding sensibly.
- Other formats: recommend only if they fit actual inputs and can be maintained reliably.

For every format explain parser/conversion approach for the discovered stack, browser versus backend processing, likely effects on tables/columns/page breaks/headers/footers/reading order, extraction-quality checks, and handling of original/extracted content.

Pipeline requirements:
1. Validate size and supported type using more than extension where feasible; MIME is only a hint.
2. Reject unsupported, malformed, password-protected, encrypted, corrupt, or oversized files with actionable errors.
3. Route accepted formats to the correct parser.
4. Normalize into a documented structure, such as ordered text blocks with page/section information and table data where available.
5. Detect blank, garbled, or incomplete extraction before continuing.
6. Show progress and allow cancellation where practical.
7. Handle parser errors without losing the selected file or prior results.
8. Prefer local processing; identify exactly what any external service receives, and why.
9. Apply sensible size/time/resource limits.
10. Show supported formats, size limits, privacy behavior, and limitations in the UI.

Treat DOCX conversion as a compatibility fallback only if the current parser truly requires it and direct extraction is impractical. Compare it with adapting/replacing the parser. Do not create temporary files or transmit documents unnecessarily.

## Phase 5 — Design proposal

Propose a coherent visual direction: concept and product fit; restrained palette, typography, spacing, and component principles; information hierarchy and main journey; upload, parsing, extraction review, results, and error states; mobile navigation/responsive behavior; accessibility details; prioritized screen-by-screen changes; meaningful alternatives.

If Claude Design or Artifact tools are available, create a reviewable prototype of the approved proposal before implementation. Label it a prototype; it does not authorize implementation or deployment.

## Phase 6 — Analytics and usage metrics

Recommend a lightweight, privacy-conscious analytics provider that works with the actual hosting setup. Consider Umami or a comparable service, but verify current documentation, privacy terms, and pricing before recommending a plan.

Explain metrics (views, visits, estimated unique visitors, devices, returning browser activity); cookies/identifiers and their limits; data received (including IP processing, user agent, approximate location); hosted versus self-hosted options, costs, setup and maintenance; dashboard access; owner-visit exclusion; and how users are informed and given an appropriate choice if needed.

Without accounts, visitor metrics estimate browsers or sessions, not distinct people. A person may use several devices; people may share a browser or network. Do not use user IDs, cross-device tracking, advertising identifiers, fingerprinting, or identity stitching.

Propose only a small set of anonymous events, such as app_opened, document_upload_started, document_upload_succeeded, document_upload_failed with a safe broad category, results_viewed, feedback_prompt_shown, and feedback_submitted. Explain the product question each answers. Do not track every click. Never include document text, filenames, shift data, personal details, arbitrary error text, or feedback text. Analytics failure/blocking must not break the app.

## Phase 7 — Feedback collection

A static app cannot securely store feedback itself. Compare suitable options, such as a managed form service or a small serverless endpoint with storage. Verify current pricing, privacy terms, and setup needs. For each option, explain where feedback is stored, who can access it, what is transmitted and to whom, free-tier limits/costs, spam controls, export/deletion, credentials and secret handling, and privacy notice/consent implications.

Do not choose/connect a provider until I approve the specific provider and data flow.

Propose a brief, respectful prompt with an optional 1–5 rating and optional short text; submit and “Not now”/dismiss; explanation of use; no name/email by default; no interruption during upload, parsing, or results; keyboard/screen-reader access; success and recoverable error states.

Recommend a low-frequency trigger, such as after a few successful sessions/uses and no more than once every few weeks. Explain that local storage can be cleared and prompt history does not sync across devices without login.

Requirements: never prompt during active work; “Not now” postpones; “Don’t ask again” is honored; after submission do not prompt again on that browser; keep prompt analytics separate from feedback; provide an unobtrusive persistent menu/help entry point. Never send feedback text to analytics; send it only to the approved destination.

## Phase 8 — Privacy review

Identify data each provider receives; how users will be informed; opt-out/limiting options; retention/deletion; accessibility; and any legal or organizational requirements I should confirm for users’ locations. Do not present legal conclusions as a substitute for reviewing current provider terms or qualified advice.

## Phase 9 — Approval checkpoint

Present a concise, decision-ready report with:

1. What you inspected and could not inspect
2. Highest-priority verified usability, design, accessibility, reliability, security, and performance issues
3. Separate hypotheses and missing evidence
4. Design direction and screen changes
5. Confirmed DOCX-only cause or evidence still needed
6. Supported formats and ingestion architecture
7. Analytics provider, exact events/fields, and data explicitly never collected
8. Feedback destination, data flow, prompt wording, and frequency
9. Security, privacy, cost, deployment, and maintenance implications
10. Phased implementation, dependencies, risks, and effort
11. Tests and acceptance criteria
12. Exact changes/provider choices requiring approval

Then stop and wait for my decision. Do not begin implementation in that response.

## Phase 10 — Implement only approved scope

After I approve: make a reversible backup/branch and record starting state; implement small reviewable steps; keep parsing modular and document formats/limits; make upload, progress, extraction quality, privacy, and errors clear; add only approved analytics events with limited payloads; keep feedback out of analytics and send only to approved destination; keep secrets out of browser code; ensure service failures do not block core use; add approved privacy notice; preserve existing behavior unless approved to change; do not silently change services, data flows, or deployment configuration.

## Phase 11 — Verify and report

Run appropriate checks and report actual results. Verify:
- Existing DOCX and each new format
- Renamed files with mismatched extensions
- Unsupported, oversized, malformed, empty, corrupt, password-protected files
- Scanned PDF/OCR if included; tables and realistic shift documents
- Error recovery, cancellation, representative file sizes
- Keyboard, focus, screen-reader announcements, mobile, long filenames/results
- Feedback timing, postpone/dismiss/“don’t ask again,” success/failure
- Approved analytics events only; no filenames, document contents, shift data, personal data, or feedback text in analytics
- Feedback reaches only approved destination
- No secrets in built files
- Analytics/feedback failures do not break the app; development analytics behavior matches approval

Conclude with changed files, checks and results, limitations, and local review steps. Stop before deployment/publishing and ask me to review and explicitly approve it.