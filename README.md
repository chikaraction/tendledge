[English](README.md) | [日本語](README.ja.md)

# Tendledge

A desktop AsciiDoc editor with live preview
(Tauri v2 + CodeMirror 6 + Asciidoctor.js).
Design follows Slate ([docs/design-direction.md](docs/design-direction.md)) —
dark-first with a purple accent.

## Features

- Split left/right layout (drag the divider to resize) plus view modes
  (editor only / split / preview only; Ctrl+K V / Ctrl+Shift+V)
- CodeMirror 6 editor with AsciiDoc syntax highlighting (table cells, inline
  macros, nested blocks)
- Debounced real-time conversion via Asciidoctor.js (debounce time configurable)
- Scroll sync between editor and preview (headings are paired in document
  order, with linear interpolation between them)
- Syntax highlighting for code blocks in the preview (highlight.js; statically
  baked into HTML exports)
- **Diagrams**: Mermaid (built-in), PlantUML / Draw.io (via Kroki; off by
  default — note that enabling it sends diagram sources to the Kroki server)
- **Tabs**: multiple documents open at once (Ctrl+W to close, Ctrl+Tab to
  switch; undo history, cursor position, and scroll position are kept per tab)
- **Vault**: open a folder and pick a file to edit from the sidebar file tree
  (supported extensions: adoc / asciidoc / asc / txt; the sidebar width is
  also drag-resizable)
- **Settings dialog**: theme (light / dark / follow the OS), editor font size,
  preview debounce, and Kroki opt-in, persisted via `tauri-plugin-store`
- HTML export (standalone single file with diagrams and highlighting baked
  in), PDF / print (via `window.print()` and the OS print dialog)
- **Built-in help** (F1 or the Help menu): shortcuts and known limitations,
  shown in a read-only preview tab
- Custom menu bar and status bar (line/column, character count, conversion
  time), window position/size restored across launches
- Preview HTML is sanitized with DOMPurify (so opening a third party's file
  in the vault can't run scripts) + CSP configured
- UI icons from [Lucide](https://lucide.dev/) (ISC license)
- Unit tests via Vitest (`npm test`; pure logic lives under `src/core/`)

## Prerequisites

- Node.js 18 or later
- Rust toolchain (https://rustup.rs)
- On Windows: the WebView2 runtime (bundled with Windows 10/11 by default)

## Setup

```sh
# 1. Clone the repository
git clone https://github.com/chikaraction/tendledge.git
cd tendledge

# 2. Install dependencies
npm install

# 3. Start development mode
npm run tauri dev
```

The first run takes a few minutes to compile the Rust side; subsequent runs
are fast. For a distributable build, run `npm run tauri build` (installers are
generated under `src-tauri/target/release/bundle/`).

## Structure

| File | Role |
| --- | --- |
| `src/main.ts` | Composition root (looks up DOM, wires up modules: file I/O, vault, settings) |
| `src/core/` | Pure logic (tab state, tree building, scroll interpolation, settings schema, view modes, etc.); tests live alongside |
| `src/ui/` | DOM layer (editor, preview, tab bar, file tree, menu bar, settings dialog, etc.) |
| `src/render.ts` | Asciidoctor.js conversion + DOMPurify sanitization |
| `src/asciidoc-mode.ts` | AsciiDoc syntax highlighting (StreamLanguage, nested blocks via a block stack) |
| `src/help-doc.ts` | Built-in help content (AsciiDoc) |
| `src/styles.css` | Layout and preview styles, theme variables, `@media print` for printing |
| `index.html` | Skeleton for the menu bar, tab bar, sidebar, two panes, and status bar |
| `sample/` | Sample documents per syntax topic (open the folder as a vault) |
| `docs/` | Design documents ([design-direction.md](docs/design-direction.md), [roadmap.md](docs/roadmap.md), [backlog.md](docs/backlog.md), and per-milestone `milestone-N-plan.md`) |

## Notes

- The `include::` directive is not supported (the bundled Asciidoctor.js
  cannot read local files during conversion). Known limitations are also
  listed in the built-in help (F1).
- The number at the right edge of the status bar is the conversion time in ms.
- PDF export goes through the app's `window.print()` call to the OS print
  dialog ("Save as PDF"). Verified working on Windows (WebView2), but the
  WebKit-based backends on macOS/Linux have a known issue with unstable
  print-dialog behavior.
- Scroll sync pairs heading lines with the preview's heading elements in
  document order, and interpolates linearly between them. Sync granularity
  is coarser inside long blocks with few headings.
