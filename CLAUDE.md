# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Tauri v2 desktop app: an AsciiDoc editor with live preview, built on CodeMirror 6 (editor) and Asciidoctor.js (renderer). Frontend is TypeScript/Vite, native shell is Rust. Currently at milestones 1–3 of the plan in [README.md](README.md); milestones 4–5 (richer highlighting, file open/save, scroll sync, HTML/PDF export) are not yet implemented.

Comments, commit-facing docs, and UI strings in this repo are written in Japanese — match that convention when editing existing files.

## Commands

```sh
npm run dev          # Vite dev server only (frontend, no Tauri shell)
npm run tauri dev    # Full app: Rust build + Tauri window + Vite dev server
npm run build         # tsc typecheck + vite build (frontend only)
npm run tauri build   # Production desktop bundle
npm run preview       # Preview the built frontend
```

There is no test suite or lint script configured in [package.json](package.json) — don't assume `npm test` or `npm run lint` exist.

Rust side (`src-tauri/`) builds via the `tauri` CLI above; there's no need to invoke `cargo build` directly during normal frontend work.

## Architecture

- [index.html](index.html) defines the static two-pane skeleton (`#editor-pane`, `#divider`, `#preview-pane`); all behavior is wired up in [src/main.ts](src/main.ts).
- [src/main.ts](src/main.ts) does three things: constructs the single Asciidoctor.js processor and `render()`/`scheduleRender()` (300ms debounce, converts with `safe: "safe"` — `include::` won't work without further filesystem wiring), builds the CodeMirror `EditorView` with the custom AsciiDoc mode, and implements the divider drag-to-resize (writes the `--editor-ratio` CSS variable read by [src/styles.css](src/styles.css)).
- [src/asciidoc-mode.ts](src/asciidoc-mode.ts) is a hand-written `StreamParser` (not a Lezer grammar) providing line-oriented AsciiDoc syntax highlighting for CodeMirror. It's intentionally minimal (README milestone 4 calls out gaps: table internals, inline macro edge cases, nesting) — extend the `token()` state machine here rather than introducing a separate highlighting mechanism.
- The Rust side ([src-tauri/src/lib.rs](src-tauri/src/lib.rs)) is still the Tauri template: one placeholder `greet` command and the `opener` plugin. Permissions are declared in [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json) (`core:default`, `opener:default` only) — any new Tauri plugin (e.g. `plugin-fs`, `plugin-dialog` for the planned file open/save) needs both a Cargo dependency in [src-tauri/Cargo.toml](src-tauri/Cargo.toml) and a corresponding permission entry there.
- Vite is pinned to port 1420 with `strictPort: true` ([vite.config.ts](vite.config.ts)) because [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) hardcodes `devUrl: http://localhost:1420`.
