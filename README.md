# PDF Filler

A local, single-user PDF form filler with no accounts, no subscription, and no cloud. Fill government and other PDF forms (AcroForm or flat/scanned), drop text, dates, checkmarks, and signatures anywhere on the page, and export a finished, flattened PDF to print or submit. It is an early build, so the design isn't final. Everything stays on your machine: no file, field value, or signature ever leaves the browser.

## Getting Started

This project uses pnpm (not npm or yarn). Requires Node.js 20 or newer.

Install and run the dev server:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 with your browser. There is nothing to configure: no env file, no accounts, no services to start.

## Scripts

- `pnpm dev` - start the dev server
- `pnpm build` - production build
- `pnpm lint` - run the linter
- `pnpm typecheck` - TypeScript check
- `pnpm test` - run the tests
- `pnpm format` - format with Prettier

## Tech

Next.js (App Router) and TypeScript, Tailwind v4 with shadcn/ui, pdfjs-dist for rendering, pdf-lib for filling and flattening, Dexie for IndexedDB storage, Zustand for editor UI state, react-rnd for drag and resize, signature_pad for signatures, React Hook Form with Zod, and Jest with React Testing Library for tests.

## Notes

- Fully client-side. There is no backend, no network calls, and nothing is uploaded. All persistence is IndexedDB via Dexie.
- Editing is non-destructive: the original PDF bytes are stored once and never mutated. Overlays and field values are stored separately as JSON; export is the only step that produces a new PDF.
- All screen-to-PDF coordinate math lives in one place, `src/lib/pdf/coords.ts`, so placement on screen matches the exported file (including rotated pages).
- Design tokens live in the `@theme` block of `src/app/globals.css`, so a real design system can be swapped in later without rewriting components.
