[English](README.md) | [日本語](README.ja.md)

# Tendledge (Tauri + CodeMirror 6 + Asciidoctor.js)

An AsciiDoc editor with live preview (Milestones 1–7 implemented).
Design follows Slate ([docs/design-direction.md](docs/design-direction.md)) — dark-first with a purple accent.

- Split left/right layout (drag the divider to resize)
- CodeMirror 6 editor with AsciiDoc syntax highlighting (table cells, inline
  macros, nested blocks)
- Debounced real-time conversion via Asciidoctor.js (debounce time configurable)
- Light / dark mode (fixed from the View menu or Settings, or follows the OS)
- **Menu bar**: file operations, export, settings, theme toggle, sidebar toggle
  (keyboard shortcuts Ctrl+N/O/S/Shift+S supported)
- **Status bar**: line/column, character count, and conversion time shown at all times
- New / open / save / save-as for files (via `@tauri-apps/plugin-fs` +
  `plugin-dialog`)
- **Tabs**: multiple documents open at once (Ctrl+W to close, Ctrl+Tab to
  switch; undo history and cursor position are kept per tab)
- **Vault**: open a folder and pick a file to edit from the sidebar file tree
  (supported extensions: adoc / asciidoc / asc / txt)
- **Settings dialog**: change theme, editor font size, and preview debounce,
  persisted via `tauri-plugin-store`
- Scroll sync between editor and preview (headings are paired in document
  order, with linear interpolation between them)
- HTML export, PDF / print (via `window.print()` and the OS print dialog)
- Preview HTML is sanitized with DOMPurify (so opening a third party's file
  in the vault can't run scripts) + CSP configured
- Icons from [Lucide](https://lucide.dev/) (ISC license)
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
are fast.

## Structure

| File | Role |
| --- | --- |
| `src/main.ts` | Composition root (looks up DOM, wires up modules: file I/O, vault, settings) |
| `src/core/` | Pure logic (tab state, tree building, scroll interpolation, settings schema, etc.); tests live alongside |
| `src/ui/` | DOM layer (editor, preview, tab bar, file tree, settings dialog, etc.) |
| `src/render.ts` | Asciidoctor.js conversion + DOMPurify sanitization |
| `src/asciidoc-mode.ts` | AsciiDoc syntax highlighting (StreamLanguage, nested blocks via a block stack) |
| `src/styles.css` | Layout and preview styles, theme variables, `@media print` for printing |
| `index.html` | Skeleton for the toolbar, tab bar, sidebar, and two panes |
| `docs/milestone-6-plan.md` | Design document for Milestone 6 |

## Notes

- Conversion runs in `safe: "safe"` mode. The `include::` directive is
  disabled in this mode, so using it requires revisiting the conversion
  options.
- The number at the right edge of the toolbar is the conversion time in ms.
- PDF export goes through the app's `window.print()` call to the OS print
  dialog ("Save as PDF"). Verified working on Windows (WebView2), but the
  WebKit-based backends on macOS/Linux have a known issue with unstable
  print-dialog behavior.
- Scroll sync pairs heading lines with the preview's heading elements in
  document order, and interpolates linearly between them. Sync granularity
  is coarser inside long blocks with few headings.
