# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tauri v2 desktop app: an AsciiDoc editor with live preview, built on CodeMirror 6 (editor) and Asciidoctor.js (renderer). Frontend is TypeScript/Vite, native shell is Rust. Milestones 1–6 are implemented (editor/preview, resizable panes, highlighting, file I/O, scroll sync, HTML/PDF export, tabs, vault sidebar, settings). The long-term goal is an Obsidian-like experience; new features are added incrementally — no plugin system planned. Milestone 6's design doc is [docs/milestone-6-plan.md](docs/milestone-6-plan.md).

Comments, commit-facing docs, and UI strings in this repo are written in Japanese — match that convention when editing existing files.

## Commands

```sh
npm run dev          # Vite dev server only (frontend, no Tauri shell)
npm run tauri dev    # Full app: Rust build + Tauri window + Vite dev server
npm run build         # tsc typecheck + vite build (frontend only)
npm run tauri build   # Production desktop bundle
npm run preview       # Preview the built frontend
npm test              # Vitest (unit tests for src/core/ pure logic + sanitizer)
npm run test:watch    # Vitest watch mode
```

Tests follow a t-wada-style discipline: pure logic lives in `src/core/` with colocated `*.test.ts` specs (Japanese `describe`/`it` that read as specifications); new core logic is written test-first, and existing behavior was locked with characterization tests before refactoring. There is no lint script — don't assume `npm run lint` exists.

Commit each completed feature as you go, without asking for confirmation — one feature per commit, message in Japanese, on a feature branch. Do not batch a whole milestone into one working-tree pile and split it afterwards (retroactive splitting is expensive and error-prone). Pushing and PR creation still require an explicit request.

When implementing a new milestone/feature, follow the workflow in the `milestone` skill (`.claude/skills/milestone/SKILL.md`). Manual verification steps for Tauri-only features live in the `verify-tauri` skill.

Rust side (`src-tauri/`) builds via the `tauri` CLI above; there's no need to invoke `cargo build` directly during normal frontend work.

## Architecture

- [index.html](index.html) defines the static skeleton (toolbar, `#tabbar`, `#sidebar`, `#editor-pane`, `#divider`, `#preview-pane`, `#settings-dialog`); behavior is wired up from [src/main.ts](src/main.ts).
- The frontend is layered: [src/core/](src/core/) holds pure logic with no DOM/Tauri imports (unit-tested — `documents.ts` tab state, `vault-tree.ts` file-tree model, `scroll-sync.ts` anchor interpolation, `settings.ts` schema/merge, `paths.ts`, `headings.ts`); [src/ui/](src/ui/) holds the DOM layer (`editor.ts`, `preview.ts`, `tabs.ts`, `file-tree.ts`, `settings-dialog.ts`, `scroll-sync.ts` wiring, `divider.ts`, `shortcuts.ts`); [src/render.ts](src/render.ts) wraps Asciidoctor.js (converts with `safe: "safe"` — `include::` won't work under this safe mode); [src/main.ts](src/main.ts) is the composition root that only looks up DOM and connects modules. Put new logic in `core/` (with tests) and keep `ui/` thin.
- Tabs: one shared `EditorView` whose `EditorState` is swapped per tab (states kept in a `Map` in main.ts, so undo history/cursor survive tab switches); which-tabs-exist/dirty state lives in `core/documents.ts`, which guarantees at least one document always exists. New/Open create tabs; the discard-confirm only happens when closing a dirty tab (Ctrl+W; Ctrl+Tab cycles).
- Vault: "フォルダを開く" picks a directory, main.ts walks it recursively via the fs plugin's `readDir`, `core/vault-tree.ts` builds the filtered/sorted tree (supported extensions only, dot-entries and empty dirs hidden), `ui/file-tree.ts` renders it and preserves fold state across re-renders. There is no file watching — the sidebar has a manual ↻ refresh.
- Settings (theme / editor font size / preview debounce): schema + validation in `core/settings.ts` (`mergeSettings` falls back to defaults per key), persisted via `tauri-plugin-store` to `settings.json`, with an in-memory fallback so the browser-only preview still works. Theme is applied as a `data-theme` attribute on `<html>` ("system" removes it and defers to `prefers-color-scheme`); font size flows through the `--editor-font-size` CSS variable.
- XSS: preview HTML goes through DOMPurify (`sanitizePreviewHtml` in render.ts) because AsciiDoc passthrough blocks (`++++`) emit raw HTML even under `safe: "safe"`, and the vault feature means opening third-party files in a WebView that holds Tauri API access. The standalone HTML export is deliberately **not** sanitized (users' own passthrough content must survive). A CSP is set in [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json).
- Scroll sync pairs source heading lines (`/^=+\s/`) with the preview's rendered `h1`–`h6` elements by document order into `headingAnchors`, then linearly interpolates scroll position between anchors in both directions (`previewScrollTopForLine` / `editorLineForPreviewScrollTop`). This was deliberately chosen over Asciidoctor.js's `sourcemap` option, which only annotates internal AST nodes and does **not** emit `data-lineno`-style attributes into HTML5 converter output — verified against `node_modules/@asciidoctor/core`'s source, not assumed. A `syncingScroll` guard (released via both `requestAnimationFrame` and a `setTimeout` fallback, since rAF alone can get stuck when the window isn't actively rendering) prevents the two scroll listeners from feeding back into each other.
- PDF export is `window.print()` plus an `@media print` block in [src/styles.css](src/styles.css) that hides everything but `.adoc` and forces light-mode CSS variables. This is reliable on Windows/WebView2 but has known print-dialog reliability issues on macOS/Linux WebKit-based Tauri builds — accepted tradeoff, not a bug to "fix" by adding a PDF library.
- Tauri v2's `fs` plugin's `fs:default` permission only grants access to app-specific directories (AppConfig/AppData/etc.), not arbitrary user-picked paths — file open/save/vault needs the explicit `fs:allow-read-text-file` / `fs:allow-write-text-file` / `fs:allow-read-dir` permissions (scope-free) declared in [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json), verified against the installed `tauri-plugin-fs` crate's `permissions/autogenerated/commands/*.toml`. Settings persistence uses `store:default` (verified the same way against `tauri-plugin-store`).
- [src/asciidoc-mode.ts](src/asciidoc-mode.ts) is a hand-written `StreamParser` (not a Lezer grammar) providing line-oriented AsciiDoc syntax highlighting for CodeMirror. Delimited blocks (code, literal, example, sidebar, quote, open, table) are tracked with a `state.blockStack`, where a block only closes on a line whose trimmed text exactly matches the opening delimiter — this is what makes nested blocks (e.g. a sidebar inside an example block) resolve correctly. Extend the `token()` state machine and `BLOCK_DELIMITERS` table here rather than introducing a separate highlighting mechanism.
- The Rust side ([src-tauri/src/lib.rs](src-tauri/src/lib.rs)) registers the `opener`, `fs`, `dialog`, and `store` plugins; there are no custom `#[tauri::command]`s — all file I/O goes through the plugins' own JS-side APIs. Permissions live in [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json). Any new Tauri plugin needs both a Cargo dependency in [src-tauri/Cargo.toml](src-tauri/Cargo.toml) and a corresponding permission entry there — verify exact permission identifier strings against the regenerated `src-tauri/gen/schemas/desktop-schema.json` (gitignored, appears after a build) or the installed crate's `permissions/` directory under `~/.cargo/registry/src/`, don't guess them.
- Vite is pinned to port 1420 with `strictPort: true` ([vite.config.ts](vite.config.ts)) because [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) hardcodes `devUrl: http://localhost:1420`.
