# My Shifts

A small, private roster viewer for one nurse. It reads an existing department roster (Excel, Word, PDF or CSV) **in the browser**, then shows her shifts, days off, leave, and who is on each shift.

It only **reads** a roster. It cannot create or edit rosters, assign shifts, or request or approve swaps, and it never changes the original file.

## Privacy

- Files are read on the device. Nothing is uploaded, and there is no server, analytics or third-party service.
- The production build includes a Content Security Policy with `connect-src 'none'`, so the page cannot send data anywhere.
- The confirmed roster is stored only in this browser (IndexedDB). The selected name, shift-code meanings and appearance choices (light/dark, colour palette) are stored in `localStorage`.
- **Roster → Remove roster from this device** deletes the roster and the selected name. Appearance choices are kept (they contain no roster data).
- `.gitignore` excludes `*.pdf`, `*.docx`, `*.xlsx`, `*.xls` and `*.csv`, so real rosters can't be committed by accident.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (synthetic data)
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Optional check against real roster files kept **outside** the repository. It prints counts only, never names:

```powershell
$env:ROSTER_SAMPLE_DOCX="C:\path\roster.docx"; $env:ROSTER_SAMPLE_PDF="C:\path\roster.pdf"; npx vitest run tests/local-sample.test.ts
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repository, on the `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Each push to `main` runs the tests, builds the app, and publishes it. The workflow is in `.github/workflows/deploy.yml`.

The build uses relative paths and hash routing, so it works under any repository name.

## Import flow

1. **Choose file.** The format is detected from the file's contents, not just its extension.
2. **Pick table/sheet/page**, if the file has more than one.
3. **Check layout.**
   - Choose names-down/dates-across or one-row-per-shift.
   - Pick the names column and any detail columns (such as rank).
   - Confirm the month and year (required). The app checks the weekday letters against the chosen month.
   - Review the rows that will be skipped, such as totals.
4. **Leave.** Words spelled one letter per cell (`A N N U A L`, `M A T E R N I T Y`) are found and must be confirmed. Otherwise "A" would be read as Afternoon and "N" as Night.
5. **Shift codes.** Every distinct entry is listed. You confirm what each one means and can add times. You must also choose what an empty cell means; blanks are never treated as days off unless you say so.
6. **Review.**
   - Totals and warnings are shown.
   - You can compare any person's row against the original, side by side.
   - **Use this roster** replaces the current one.

## Project layout

```
src/lib/parse/       format readers → generic tables (docx, xlsx/xls, pdf, csv)
src/lib/interpret/   layout detection, draft, leave words, codes, final roster
src/lib/roster.ts    selectors used by the screens
src/lib/storage.ts   on-device storage
src/import/          import wizard steps
src/views/           dashboard, calendar, agenda, day view, name picker, roster info
tests/               unit tests (synthetic) + optional local real-file check
```
