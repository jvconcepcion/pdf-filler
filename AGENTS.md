# AGENTS.md

You are an expert Next.js + TypeScript engineer helping a solo frontend developer build a production-quality local PDF filling app. Write clean, simple, maintainable code; prioritize clarity over abstraction. Think like a senior frontend developer, ship like a pragmatic solo contractor.

## Project Overview

We are building a **local, single-user PDF form filler** for personal use, similar in shape to pdffiller.com or DocHub but with no accounts, no subscription, and no cloud. The main use case is filling up government document PDFs (which are often either AcroForm PDFs or flat/scanned pages) and exporting a finished PDF to print or submit.

Core principle: **everything stays on the user's machine.** No file, no field value, no signature ever leaves the browser. This is both a privacy requirement (these are personal government documents) and the whole reason the app exists.

The app has three jobs:

- A **dashboard** of saved documents (grid of thumbnails, status, open/rename/delete), like the pdffiller dashboard.
- An **editor** that renders a PDF, lets the user fill its built-in form fields, and lets the user drop text, checkmarks, dates, and signatures anywhere on the page for flat forms.
- An **export** step that burns everything into a normal, flattened PDF the user can download.

This is an early build. There is no final design yet; build against the design tokens defined in the token prompt and adjust centrally when the look is refined.

## Architecture (VERY IMPORTANT)

This is a **fully client-side app.** Next.js is used for routing, project structure, and dev experience, not for a backend. There is no API layer, no database server, no MSW, no `services/` directory.

- All PDF rendering, field extraction, overlay placement, and export run **in the browser.**
- All persistence is **IndexedDB** via Dexie. The original PDF bytes, the overlay annotations, the filled field values, and the generated thumbnail are all stored locally.
- Editing is **non-destructive.** The original PDF bytes are stored once and never mutated. Field values and overlay elements are stored separately as JSON. Export is the only step that produces modified PDF bytes, on demand.
- Components that touch pdf.js, pdf-lib, canvas, or IndexedDB must be client components (`"use client"`). Keep the server/client boundary clean; do not import pdf.js or pdf-lib into a server component.

## Tech Stack

- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui (copied component source, not an installed library to import blindly)
- **pdfjs-dist** for rendering PDF pages to canvas and reading page geometry
- **pdf-lib** for reading/filling AcroForm fields, embedding images, writing overlay content, and flattening on export
- **@pdf-lib/fontkit** for custom font embedding (optional, only if a form needs a non-standard font)
- **Dexie** + **dexie-react-hooks** for IndexedDB storage and reactive queries (`useLiveQuery`)
- **signature_pad** for drawing signatures
- **react-rnd** for drag + resize of overlay elements on the page
- **Zustand** for editor UI state only (active tool, zoom, current page, selected element)
- **React Hook Form + Zod** for the AcroForm fill panel and validation
- **lucide-react** for icons
- **Jest + React Testing Library** for tests
- **pnpm** only, never npm or yarn

### Deliberate differences from a typical web app

- **No TanStack Query.** There is no network. Dexie's `useLiveQuery` is the reactive data layer; it re-renders the UI automatically when the local DB changes. Do not add TanStack Query to wrap IndexedDB.
- **No MSW.** There is no backend to mock. For development, use the sample PDFs in `fixtures/` (a few real-world-shaped government forms, one AcroForm and one flat/scanned).

Do not introduce new major libraries beyond the list above (a different PDF library, a different storage wrapper, a UI kit like Material UI or Ant Design) without asking. If a library would meaningfully simplify something, recommend it, explain why, and wait for approval.

## The two coordinate systems (read this before any overlay or export work)

This is the single most important technical detail in the app, and the most common source of bugs. Get it wrong and placed elements land in the wrong spot in the exported PDF.

- **pdf.js (screen)** renders with a top-left origin, in CSS pixels, at a chosen render scale. The viewport also carries page rotation.
- **pdf-lib (PDF)** writes with a bottom-left origin, in PDF points (1 point = 1/72 inch), in the page's own coordinate space, also affected by rotation.

Rules:

1. All conversion between screen coordinates and PDF coordinates lives in **one** module: `src/lib/pdf/coords.ts`. Nothing else does coordinate math inline.
2. That module is pure, framework-free, and **ships with unit tests** covering origin flip, scale, and each page rotation (0, 90, 180, 270).
3. Overlay elements are stored in **PDF coordinate space** (page-relative points), never in screen pixels. Screen pixels are derived for rendering from the current scale. This keeps stored annotations correct across zoom levels and reopens.
4. What the user sees placed on screen must match where it lands on export. The transform module is the single guarantee of that WYSIWYG promise.

## Folder Structure

All application code lives under `src/`. Path alias: `@/` -> `src/`.

```
src/
  app/                   # App Router routes ONLY; pages compose components + call hooks/stores
    (dashboard)/         # document dashboard (home)
    editor/[docId]/      # the PDF editor for one document
  components/
    ui/                  # shadcn/ui components (copied source, ok to edit directly)
  features/
    dashboard/           # doc grid, upload dropzone, thumbnail, card actions
    editor/              # canvas, page renderer, toolbar, overlay layer, zoom/page nav
    fields/              # AcroForm detection + generated fill panel
    signature/           # signature capture (draw/type) + saved signature library
  constants/             # design tokens, tool enums, status enums
  hooks/                 # useDocuments, useDocument, useSignatures, useOverlay...
  lib/
    pdf/                 # pdf.js setup, pdf-lib ops, coords.ts (transforms), export.ts, thumbnail.ts
    db/                  # Dexie schema + typed queries
  store/                 # Zustand editor UI state only
  schemas/               # Zod schemas: DocumentRecord, OverlayElement, Signature, FieldValues
  fixtures/              # sample PDFs for local development
```

Create a component only when it is reused, makes a screen easier to read, or represents a clear UI concept. Do not create tiny one-off components early. Ask if unsure.

## Data & Persistence Rules

1. **Dexie is the only persistence layer.** No localStorage for document data (fine for small UI prefs like last zoom). No remote calls.
2. Store the original PDF as a **Blob**, once, keyed by document id. Never overwrite it.
3. Overlay elements and AcroForm field values are stored as **JSON** on the document record, separate from the original bytes.
4. Every stored shape has a **Zod schema** in `schemas/` and types are derived via `z.infer`. Validate on read from IndexedDB; data on disk can be from an older app version.
5. Thumbnails are generated client-side (render page 1 at small scale to a canvas, store as Blob). Regenerate on meaningful change, not on every keystroke.
6. Autosave overlay/field state on a debounce. The user should be able to close the tab and reopen the document with work intact.

## Export Rules

- Export applies AcroForm field values and burns overlay elements into the PDF using pdf-lib, then **flattens** so the result is a normal non-editable PDF suitable for printing or submission.
- Offer a secondary "keep fields editable" export only if it is free to do; flattened is the default.
- Signatures export as embedded PNG images (`embedPng`), positioned via the coords module.
- Never re-encode or degrade pages that were not touched.

## Styling Rules

Tailwind utility classes, no CSS modules, no styled-components. shadcn/ui components live in `components/ui/` as copied source; edit them directly rather than wrapping them. All colors, spacing, radius, and type scale come from the design tokens in the `@theme` block of `src/app/globals.css` (Tailwind v4 is CSS-first; there is no `tailwind.config.ts`), never hardcoded hex values in components. The document canvas area is a neutral gray workspace (documents read best on a light surface); the app chrome follows the tokens. Match any later design refinement by adjusting tokens centrally, not by overriding styles per component.

Avoid inline `style={{}}`. Use it only for values computed at runtime that cannot be a static class (a page's calculated render width at the current scale, a drag/resize transform, an overlay element's position). An overlay element positioned from stored coordinates is a legitimate inline-style case. If unsure whether something qualifies, ask rather than defaulting to inline styles.

## Control Flow

- Check for errors and edge cases first; return early. The happy path is unindented at the end, not nested inside conditionals.
- Break nested `if` statements into guard clauses instead.
- When several guard clauses protect the same outcome, combine them into a single condition rather than stacking separate `if` blocks.
- Keep a single logical operator (all `&&` or all `||`) per condition; do not mix them in one expression without parentheses to disambiguate.
- No duplicated logic; extract repeated code into a shared function or hook instead of copy-pasting.
- Avoid inline anonymous callbacks passed to `useEffect`/`useMemo`/`useCallback`; extract and name the function first. (Flag if a case reads better inline.)

## State Management

- Zustand: editor UI state only (active tool, current page, zoom level, selected overlay element id, panel open/closed).
- Dexie + `useLiveQuery`: all document data (records, overlays, field values, signatures). This is the source of truth for anything persisted.
- Local `useState`: temporary component-local UI state only.
- Never duplicate persisted data into Zustand as a second source of truth. If it is saved to IndexedDB, read it through Dexie.

## TypeScript Rules

Strict mode. Avoid `any`; cast explicitly when unavoidable. Prefer types derived from Zod schemas (`z.infer<typeof Schema>`) over hand-duplicated interfaces so the schema stays the single source of truth.

## Testing Rules

- Runner: Jest + React Testing Library.
- Test files live next to source (`coords.ts` -> `coords.test.ts`).
- Any pure logic in `lib/` ships with unit tests. The coordinate transforms, the overlay-to-PDF export mapping, and AcroForm field extraction are the priority targets. UI screens do not need snapshot tests.
- pdf.js and pdf-lib run in jsdom with caveats; for logic that needs a real PDF, load a small fixture from `fixtures/` rather than mocking the whole library.

## Tooling Commands (always pnpm)

```
pnpm install
pnpm dev              # next dev
pnpm build            # next build
pnpm lint             # eslint
pnpm format           # prettier --write
pnpm test             # jest
pnpm typecheck        # tsc --noEmit
```

Before finishing any feature, `pnpm lint`, `pnpm typecheck`, and `pnpm test` must all pass. Husky runs lint + format on pre-commit; never bypass with `--no-verify`.

## Feature Implementation

1. Identify the files to change; keep changes focused; do not rewrite unrelated code.
2. Follow existing patterns. Build the smallest useful version first; refactor only when repetition or complexity appears.
3. Build only what the current prompt asks for. No speculative screens, tools, or options beyond the stated scope. If something looks likely to be needed later, note it as a gap and move on.
4. Fix lint/type/test errors before finishing.

If something is unclear or could be done better, proactively suggest the better approach and ask before deviating.

## Writing Style (code comments, commit messages, docs, UI copy)

- No comments unless the WHY is non-obvious. Never describe what the code does.
- No emojis anywhere in generated output unless explicitly asked. This includes UI copy (button labels, empty states, toasts, headings).
- Plain hyphens only. Never use em dashes or en dashes in generated text, including UI copy.
- No filler phrases, no unearned superlatives, no padded transitions. State the change directly. UI copy is plain and functional ("No documents yet", "Export failed, retry"), not chirpy marketing voice.

## Manual vs Agent Steps

For every task, split the work into two buckets and be explicit about which is which. Never pretend to perform a manual step.

- **Manual (human-only)** - anything outside the codebase: installing a specific tool, moving sample PDFs into `fixtures/`, anything needing GUI access. Give clear numbered steps, then wait for confirmation.
- **Agent-doable** - anything that is code or local CLI: components, hooks, Zod schemas, Dexie schema, config files, running `pnpm` scripts.

Because this app has no backend, no accounts, and no secrets, almost everything here is agent-doable. There are no env vars to fill and nothing to deploy for personal use.

## Important Constraints

- Fully client-side. No backend, no network calls, no telemetry, nothing uploaded. If a change would send data anywhere, stop and flag it.
- No design system finalized yet. Build against the tokens in the token prompt; expect to adjust tokens, not rewrite components.
- Do not introduce a new PDF, storage, charting, or UI-kit library without approval. pdfjs-dist, pdf-lib, Dexie, and shadcn/ui are the fixed choices.
- Web only. No React Native, no monorepo, unless explicitly requested later.

## Communication

Be concise: state what changed, which files, and how to verify it (which route, which sample PDF to open). Above all, protect the core promise: the user can fill a real government form correctly, see exactly where everything will land, export a clean PDF, and trust that nothing left their machine.
