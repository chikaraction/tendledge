// 合成ルート: DOM の取得と各モジュールの接続だけを行う。
// ロジックは core/(純粋関数)、DOM 操作は ui/、変換は render.ts に置く。
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { basename, suggestedExportName } from "./core/paths";
import { convertToStandaloneHtml } from "./render";
import { sampleDoc } from "./sample-doc";
import { setupDivider } from "./ui/divider";
import { createEditor, setDoc } from "./ui/editor";
import { createPreview } from "./ui/preview";
import { setupScrollSync } from "./ui/scroll-sync";
import { setupShortcuts } from "./ui/shortcuts";

// ---------------------------------------------------------------------------
// DOM 要素
// ---------------------------------------------------------------------------
const previewEl = document.getElementById("preview")!;
const previewPaneEl = document.getElementById("preview-pane")!;
const statusEl = document.getElementById("status")!;
const filenameEl = document.getElementById("filename")!;
const dirtyIndicatorEl = document.getElementById("dirty-indicator")!;

// ---------------------------------------------------------------------------
// ファイル状態(新規 / 開く / 保存)
// ---------------------------------------------------------------------------
let currentFilePath: string | undefined;
let lastSavedContent = sampleDoc;
let isDirty = false;

function updateFileIndicator(): void {
  filenameEl.textContent = currentFilePath ? basename(currentFilePath) : "Untitled";
}

function updateDirtyState(doc: string): void {
  isDirty = doc !== lastSavedContent;
  dirtyIndicatorEl.classList.toggle("visible", isDirty);
}

function confirmDiscardIfDirty(): boolean {
  if (!isDirty) return true;
  return window.confirm("保存されていない変更があります。破棄して続行しますか?");
}

// ---------------------------------------------------------------------------
// プレビューとエディタ
// ---------------------------------------------------------------------------
const preview = createPreview({ previewEl, paneEl: previewPaneEl, statusEl });

const view = createEditor({
  parent: document.getElementById("editor-pane")!,
  doc: sampleDoc,
  onDocChanged: (doc) => {
    preview.scheduleRender(doc);
    updateDirtyState(doc);
  },
});

// 初回描画(デバウンスなしで即時)
preview.render(view.state.doc.toString());
updateFileIndicator();
view.focus();

setupDivider(document.getElementById("workspace")!, document.getElementById("divider")!);
setupScrollSync(view, preview);

// ---------------------------------------------------------------------------
// 新規 / 開く / 保存 / 名前を付けて保存
// ---------------------------------------------------------------------------
async function doNew(): Promise<void> {
  if (!confirmDiscardIfDirty()) return;
  setDoc(view, "");
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
  setDoc(view, content);
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

// ---------------------------------------------------------------------------
// HTML / PDF エクスポート
// ---------------------------------------------------------------------------
async function exportHtml(): Promise<void> {
  const html = convertToStandaloneHtml(view.state.doc.toString());
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

// ---------------------------------------------------------------------------
// ツールバーとショートカット
// ---------------------------------------------------------------------------
document.getElementById("btn-new")!.addEventListener("click", () => void doNew());
document.getElementById("btn-open")!.addEventListener("click", () => void doOpen());
document.getElementById("btn-save")!.addEventListener("click", () => void doSave());
document.getElementById("btn-save-as")!.addEventListener("click", () => void doSaveAs());
document.getElementById("btn-export-html")!.addEventListener("click", () => void exportHtml());
document.getElementById("btn-export-pdf")!.addEventListener("click", () => exportPdf());

setupShortcuts({
  onNew: () => void doNew(),
  onOpen: () => void doOpen(),
  onSave: () => void doSave(),
  onSaveAs: () => void doSaveAs(),
  onPrint: exportPdf,
});
