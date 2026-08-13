# Security Policy

## Supported versions

Tendledge is pre-1.0 and developed by a single maintainer. Only the latest
commit on `master` is supported — fixes are not backported.

| Version | Supported |
| --- | --- |
| `master` (latest) | Yes |
| Anything older | No |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private vulnerability reporting instead:
[Report a vulnerability](https://github.com/chikaraction/tendledge/security/advisories/new).
This creates a private advisory that only you and the maintainer can see.

Helpful things to include:

- A minimal `.adoc` file or set of steps that reproduces the issue
- Which surface is affected (live preview, vault sidebar, HTML/PDF export,
  settings, or the Tauri shell)
- Your OS and Tendledge version (or commit hash)

This is a spare-time project, so please expect a first response within about a
week rather than within hours.

## Threat model

Tendledge is a desktop application. The interesting boundary is that the vault
feature lets you open **`.adoc` files you did not write** — from a repository,
a shared folder, or a download — inside a WebView that has access to Tauri
APIs, including the filesystem.

Reports in the following areas are especially welcome:

- **Preview sanitization.** AsciiDoc passthrough blocks (`++++`) emit raw HTML
  even under Asciidoctor's `safe: "safe"` mode, so preview output is sanitized
  with DOMPurify (`sanitizePreviewHtml` in `src/render.ts`). A way to get
  script execution into the preview is a vulnerability.
- **Escaping the filesystem scope.** Path handling that lets a document read or
  write outside the opened vault.
- **CSP bypass** in the packaged app (`src-tauri/tauri.conf.json`).
- **Tauri capability scope.** Anything that reaches a plugin command beyond what
  `src-tauri/capabilities/default.json` intends to grant.

## Known non-issues

These are deliberate design decisions, not bugs. Reports about them will be
closed, though arguments for changing the design are welcome as normal issues.

- **Standalone HTML export is not sanitized.** Export is meant to faithfully
  reproduce your own document, including passthrough HTML you wrote on purpose.
  Sanitizing it would silently break legitimate content. Treat an exported file
  the same way you would treat the source document. See
  [docs/export-notes.md](docs/export-notes.md).
- **`include::` does not work.** Asciidoctor runs under `safe: "safe"`, which
  disables it. This is intentional.
- **Exports are always light-mode.** HTML and PDF export ignore the current
  theme by design.
