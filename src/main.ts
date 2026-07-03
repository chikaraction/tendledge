import { basicSetup, EditorView } from "codemirror";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import Asciidoctor from "@asciidoctor/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { asciidocMode } from "./asciidoc-mode";

// ---------------------------------------------------------------------------
// Asciidoctor.js のセットアップ(プロセッサは1回だけ生成する)
// ---------------------------------------------------------------------------
const asciidoctor = Asciidoctor();

const previewEl = document.getElementById("preview")!;
const previewPaneEl = document.getElementById("preview-pane")!;
const statusEl = document.getElementById("status")!;
const filenameEl = document.getElementById("filename")!;
const dirtyIndicatorEl = document.getElementById("dirty-indicator")!;

// ---------------------------------------------------------------------------
// スクロール同期用: 見出し行(ソース)とプレビューの見出し要素を出現順で対応付ける。
// Asciidoctor.js の sourcemap は内部AST止まりでHTMLに行番号を出力しないため、
// 見出し単位のペアリング + 見出し間の線形補間で近似する。
// ---------------------------------------------------------------------------
interface HeadingAnchor {
  lineno: number;
  el: HTMLElement;
}
let headingAnchors: HeadingAnchor[] = [];

function rebuildHeadingAnchors(source: string): void {
  const headingLines: number[] = [];
  source.split("\n").forEach((line, i) => {
    if (/^=+\s/.test(line)) headingLines.push(i + 1);
  });
  const headingEls = Array.from(
    previewEl.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
  );
  const n = Math.min(headingLines.length, headingEls.length);
  headingAnchors = Array.from({ length: n }, (_, i) => ({
    lineno: headingLines[i],
    el: headingEls[i],
  }));
}

function render(source: string): void {
  const start = performance.now();
  try {
    const html = asciidoctor.convert(source, {
      safe: "safe",
      attributes: {
        showtitle: true, // 文書タイトル(= 見出し)をプレビューに表示
        sectnums: false,
      },
    }) as string;
    previewEl.innerHTML = html;
    rebuildHeadingAnchors(source);
    statusEl.textContent = `${(performance.now() - start).toFixed(0)} ms`;
    statusEl.classList.remove("error");
  } catch (err) {
    // 変換エラーでも直前のプレビューは保持し、ステータスだけ知らせる
    statusEl.textContent = "変換エラー";
    statusEl.classList.add("error");
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// デバウンス: 入力が止まってから 300ms 後に変換する
// ---------------------------------------------------------------------------
const DEBOUNCE_MS = 300;
let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleRender(source: string): void {
  clearTimeout(timer);
  timer = setTimeout(() => render(source), DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// CodeMirror 6 エディタ
// ---------------------------------------------------------------------------
const initialDoc = `= はじめての AsciiDoc
:author: あなたの名前

== これは何?

*AsciiDoc* のリアルタイムプレビュー付きエディタです。
左側を編集すると、右側に _すぐ_ 反映されます。

== 使える記法の例

* 箇条書き
* \`モノスペース\` や *太字*
** ネストもできる

. 番号付きリスト
. 二番目

[source,javascript]
----
// コードブロック
const greet = (name) => \`Hello, \${name}!\`;
----

NOTE: アドモニション(注記ブロック)も使えます。

TIP: 表やリンクなど、AsciiDoc の全機能が Asciidoctor.js で変換されます。

|===
| 列 A | 列 B

| セル 1
| セル 2
|===
`;

// ---------------------------------------------------------------------------
// ファイル状態(新規 / 開く / 保存)
// ---------------------------------------------------------------------------
let currentFilePath: string | undefined;
let lastSavedContent = initialDoc;
let isDirty = false;

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function updateFileIndicator(): void {
  filenameEl.textContent = currentFilePath ? basename(currentFilePath) : "Untitled";
}

function updateDirtyState(doc: string): void {
  isDirty = doc !== lastSavedContent;
  dirtyIndicatorEl.classList.toggle("visible", isDirty);
}

const view = new EditorView({
  doc: initialDoc,
  parent: document.getElementById("editor-pane")!,
  extensions: [
    basicSetup,
    keymap.of([indentWithTab]),
    StreamLanguage.define(asciidocMode),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const doc = update.state.doc.toString();
        scheduleRender(doc);
        updateDirtyState(doc);
      }
    }),
  ],
});

// 初回描画(デバウンスなしで即時)
render(view.state.doc.toString());
updateFileIndicator();
view.focus();

// ---------------------------------------------------------------------------
// ペインのリサイズ(ディバイダのドラッグ)
// ---------------------------------------------------------------------------
const workspace = document.getElementById("workspace")!;
const divider = document.getElementById("divider")!;

divider.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  divider.setPointerCapture(e.pointerId);

  const onMove = (ev: PointerEvent) => {
    const rect = workspace.getBoundingClientRect();
    const ratio = Math.min(0.8, Math.max(0.2, (ev.clientX - rect.left) / rect.width));
    workspace.style.setProperty("--editor-ratio", `${ratio * 100}%`);
  };
  const onUp = () => {
    divider.removeEventListener("pointermove", onMove);
    divider.removeEventListener("pointerup", onUp);
  };
  divider.addEventListener("pointermove", onMove);
  divider.addEventListener("pointerup", onUp);
});

// ---------------------------------------------------------------------------
// 新規 / 開く / 保存 / 名前を付けて保存
// ---------------------------------------------------------------------------
function confirmDiscardIfDirty(): boolean {
  if (!isDirty) return true;
  return window.confirm("保存されていない変更があります。破棄して続行しますか?");
}

function setDoc(content: string): void {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content },
  });
}

async function doNew(): Promise<void> {
  if (!confirmDiscardIfDirty()) return;
  setDoc("");
  currentFilePath = undefined;
  lastSavedContent = "";
  updateDirtyState("");
  updateFileIndicator();
}

async function doOpen(): Promise<void> {
  if (!confirmDiscardIfDirty()) return;
  const path = await open({
    multiple: false,
    filters: [{ name: "AsciiDoc", extensions: ["adoc", "asciidoc", "asc", "txt"] }],
  });
  if (!path || Array.isArray(path)) return;
  const content = await readTextFile(path);
  setDoc(content);
  currentFilePath = path;
  lastSavedContent = content;
  updateDirtyState(content);
  updateFileIndicator();
}

async function doSave(): Promise<void> {
  if (!currentFilePath) {
    await doSaveAs();
    return;
  }
  const doc = view.state.doc.toString();
  await writeTextFile(currentFilePath, doc);
  lastSavedContent = doc;
  updateDirtyState(doc);
}

async function doSaveAs(): Promise<void> {
  const doc = view.state.doc.toString();
  const path = await save({
    filters: [{ name: "AsciiDoc", extensions: ["adoc"] }],
    defaultPath: currentFilePath,
  });
  if (!path) return;
  await writeTextFile(path, doc);
  currentFilePath = path;
  lastSavedContent = doc;
  updateDirtyState(doc);
  updateFileIndicator();
}

document.getElementById("btn-new")!.addEventListener("click", () => void doNew());
document.getElementById("btn-open")!.addEventListener("click", () => void doOpen());
document.getElementById("btn-save")!.addEventListener("click", () => void doSave());
document.getElementById("btn-save-as")!.addEventListener("click", () => void doSaveAs());

// ---------------------------------------------------------------------------
// HTML / PDF エクスポート
// ---------------------------------------------------------------------------
function suggestedExportName(path: string | undefined, ext: string): string {
  if (!path) return `untitled.${ext}`;
  const base = basename(path).replace(/\.[^.]+$/, "");
  return `${base}.${ext}`;
}

async function exportHtml(): Promise<void> {
  const doc = view.state.doc.toString();
  const html = asciidoctor.convert(doc, {
    safe: "safe",
    standalone: true,
    attributes: { showtitle: true, sectnums: false },
  }) as string;
  const path = await save({
    filters: [{ name: "HTML", extensions: ["html"] }],
    defaultPath: suggestedExportName(currentFilePath, "html"),
  });
  if (!path) return;
  await writeTextFile(path, html);
}

function exportPdf(): void {
  // 実際の書き出しはブラウザ/OSの印刷ダイアログ(「PDFとして保存」)に委ねる。
  // 対象コンテンツの絞り込みは styles.css の @media print が担う。
  window.print();
}

document.getElementById("btn-export-html")!.addEventListener("click", () => void exportHtml());
document.getElementById("btn-export-pdf")!.addEventListener("click", () => exportPdf());

// ---------------------------------------------------------------------------
// キーボードショートカット
// ---------------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (!e.ctrlKey) return;
  const key = e.key.toLowerCase();
  if (key === "n") {
    e.preventDefault();
    void doNew();
  } else if (key === "o") {
    e.preventDefault();
    void doOpen();
  } else if (key === "s" && e.shiftKey) {
    e.preventDefault();
    void doSaveAs();
  } else if (key === "s") {
    e.preventDefault();
    void doSave();
  } else if (key === "p") {
    e.preventDefault();
    exportPdf();
  }
});

// ---------------------------------------------------------------------------
// スクロール同期(エディタ ⇔ プレビュー、見出しアンカー + 線形補間)
// ---------------------------------------------------------------------------
function previewOffsetOf(el: HTMLElement): number {
  const paneRect = previewPaneEl.getBoundingClientRect();
  return el.getBoundingClientRect().top - paneRect.top + previewPaneEl.scrollTop;
}

function previewScrollTopForLine(lineno: number, totalLines: number): number {
  const maxScroll = Math.max(0, previewPaneEl.scrollHeight - previewPaneEl.clientHeight);
  if (headingAnchors.length === 0) {
    return totalLines <= 1 ? 0 : (maxScroll * (lineno - 1)) / (totalLines - 1);
  }
  const first = headingAnchors[0];
  if (lineno <= first.lineno) {
    const frac = first.lineno <= 1 ? 0 : lineno / first.lineno;
    return previewOffsetOf(first.el) * frac;
  }
  for (let i = 0; i < headingAnchors.length - 1; i++) {
    const a = headingAnchors[i];
    const b = headingAnchors[i + 1];
    if (lineno >= a.lineno && lineno <= b.lineno) {
      const frac = (lineno - a.lineno) / (b.lineno - a.lineno || 1);
      return previewOffsetOf(a.el) + frac * (previewOffsetOf(b.el) - previewOffsetOf(a.el));
    }
  }
  const last = headingAnchors[headingAnchors.length - 1];
  const lastOffset = previewOffsetOf(last.el);
  const remainingFrac = totalLines <= last.lineno ? 0 : (lineno - last.lineno) / (totalLines - last.lineno);
  return lastOffset + remainingFrac * (maxScroll - lastOffset);
}

function editorLineForPreviewScrollTop(scrollTop: number, totalLines: number): number {
  const maxScroll = Math.max(0, previewPaneEl.scrollHeight - previewPaneEl.clientHeight);
  if (headingAnchors.length === 0) {
    if (maxScroll <= 0) return 1;
    return Math.round(1 + (scrollTop / maxScroll) * (totalLines - 1));
  }
  const first = headingAnchors[0];
  const firstOffset = previewOffsetOf(first.el);
  if (scrollTop <= firstOffset) {
    const frac = firstOffset <= 0 ? 0 : scrollTop / firstOffset;
    return Math.round(frac * first.lineno);
  }
  for (let i = 0; i < headingAnchors.length - 1; i++) {
    const a = headingAnchors[i];
    const b = headingAnchors[i + 1];
    const aOff = previewOffsetOf(a.el);
    const bOff = previewOffsetOf(b.el);
    if (scrollTop >= aOff && scrollTop <= bOff) {
      const frac = (scrollTop - aOff) / (bOff - aOff || 1);
      return Math.round(a.lineno + frac * (b.lineno - a.lineno));
    }
  }
  const last = headingAnchors[headingAnchors.length - 1];
  const lastOffset = previewOffsetOf(last.el);
  const remainingFrac = maxScroll <= lastOffset ? 0 : (scrollTop - lastOffset) / (maxScroll - lastOffset);
  return Math.round(last.lineno + remainingFrac * (totalLines - last.lineno));
}

function editorTopLine(): number {
  const rect = view.scrollDOM.getBoundingClientRect();
  const pos = view.posAtCoords({ x: rect.left + 4, y: rect.top + 4 }) ?? 0;
  return view.state.doc.lineAt(pos).number;
}

function editorScrollToLine(lineno: number): void {
  const line = view.state.doc.line(Math.min(Math.max(lineno, 1), view.state.doc.lines));
  view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: "start" }) });
}

let syncingScroll = false;
function withScrollGuard(fn: () => void): void {
  if (syncingScroll) return;
  syncingScroll = true;
  fn();
  const release = () => {
    syncingScroll = false;
  };
  // requestAnimationFrame が主経路。非表示タブ等で rAF が発火しない場合に
  // ガードが解除されず同期が止まったままにならないよう setTimeout で保険をかける。
  requestAnimationFrame(release);
  setTimeout(release, 100);
}

view.scrollDOM.addEventListener("scroll", () => {
  withScrollGuard(() => {
    const target = previewScrollTopForLine(editorTopLine(), view.state.doc.lines);
    previewPaneEl.scrollTop = target;
  });
});

previewPaneEl.addEventListener("scroll", () => {
  withScrollGuard(() => {
    const lineno = editorLineForPreviewScrollTop(previewPaneEl.scrollTop, view.state.doc.lines);
    editorScrollToLine(lineno);
  });
});
