// 合成ルート: DOM の取得と各モジュールの接続だけを行う。
// ロジックは core/(純粋関数)、DOM 操作は ui/、変換は render.ts に置く。
import type { EditorState } from "@codemirror/state";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { createDocumentStore } from "./core/documents";
import { basename, joinPath, suggestedExportName } from "./core/paths";
import { buildVaultTree, type RawEntry } from "./core/vault-tree";
import { convertToStandaloneHtml } from "./render";
import { sampleDoc } from "./sample-doc";
import { setupDivider } from "./ui/divider";
import { createEditor } from "./ui/editor";
import { createFileTree } from "./ui/file-tree";
import { createPreview } from "./ui/preview";
import { setupScrollSync } from "./ui/scroll-sync";
import { setupShortcuts } from "./ui/shortcuts";
import { renderTabs } from "./ui/tabs";

// ---------------------------------------------------------------------------
// DOM 要素
// ---------------------------------------------------------------------------
const previewEl = document.getElementById("preview")!;
const previewPaneEl = document.getElementById("preview-pane")!;
const statusEl = document.getElementById("status")!;
const tabbarEl = document.getElementById("tabbar")!;
const sidebarEl = document.getElementById("sidebar")!;
const vaultNameEl = document.getElementById("vault-name")!;

// ---------------------------------------------------------------------------
// ドキュメント(タブ)状態とエディタ
// ---------------------------------------------------------------------------
const store = createDocumentStore({ initialContent: sampleDoc });

// タブごとの EditorState(undo 履歴・カーソル位置を保持)。キーはドキュメント ID。
const editorStates = new Map<number, EditorState>();

const preview = createPreview({ previewEl, paneEl: previewPaneEl, statusEl });

const editor = createEditor({
  parent: document.getElementById("editor-pane")!,
  doc: sampleDoc,
  onDocChanged: (doc) => {
    store.updateContent(store.activeDoc().id, doc);
    preview.scheduleRender(doc);
    updateTabs();
  },
});
const view = editor.view;

function updateTabs(): void {
  renderTabs(tabbarEl, store.list(), store.activeDoc().id, store.isDirty, {
    onActivate: activateTab,
    onClose: (id) => void closeTab(id),
  });
}

/** アクティブタブの EditorState を退避してから、指定タブの状態に切り替える */
function switchEditorTo(id: number, previousId?: number): void {
  if (previousId !== undefined && previousId !== id) {
    editorStates.set(previousId, view.state);
  }
  const doc = store.list().find((d) => d.id === id)!;
  const state = editorStates.get(id) ?? editor.newState(doc.content);
  view.setState(state);
  preview.render(view.state.doc.toString());
  updateTabs();
  fileTree.setActivePath(doc.path);
  view.focus();
}

function activateTab(id: number): void {
  const previousId = store.activeDoc().id;
  if (id === previousId) return;
  store.activate(id);
  switchEditorTo(id, previousId);
}

async function closeTab(id: number): Promise<void> {
  if (store.isDirty(id)) {
    const ok = window.confirm("保存されていない変更があります。破棄してタブを閉じますか?");
    if (!ok) return;
  }
  const previousId = store.activeDoc().id;
  editorStates.delete(id);
  store.close(id);
  const nextActive = store.activeDoc().id;
  if (previousId === id || nextActive !== previousId) {
    switchEditorTo(nextActive);
  } else {
    updateTabs();
  }
}

// ---------------------------------------------------------------------------
// 保管庫(フォルダを開いてファイルツリーから編集対象を選ぶ)
// ---------------------------------------------------------------------------
let vaultPath: string | undefined;

const fileTree = createFileTree(document.getElementById("file-tree")!, (path) => {
  void openFileInTab(path);
});

/** readDir を再帰的に呼んでツリーの素材を集める(ドット始まりのフォルダには潜らない) */
async function walkDir(path: string): Promise<RawEntry[]> {
  const entries = await readDir(path);
  return Promise.all(
    entries.map(async (e): Promise<RawEntry> => {
      if (e.isDirectory && !e.name.startsWith(".")) {
        return {
          name: e.name,
          isDirectory: true,
          children: await walkDir(joinPath(path, e.name)),
        };
      }
      return { name: e.name, isDirectory: e.isDirectory };
    }),
  );
}

async function refreshVault(): Promise<void> {
  if (!vaultPath) return;
  const entries = await walkDir(vaultPath);
  fileTree.setTree(buildVaultTree(vaultPath, entries));
  fileTree.setActivePath(store.activeDoc().path);
  vaultNameEl.textContent = basename(vaultPath);
  vaultNameEl.title = vaultPath;
  sidebarEl.hidden = false;
}

async function doOpenFolder(): Promise<void> {
  const path = await open({ directory: true });
  if (!path || Array.isArray(path)) return;
  vaultPath = path;
  await refreshVault();
}

// 初回描画(デバウンスなしで即時)
preview.render(view.state.doc.toString());
updateTabs();
view.focus();

setupDivider(document.getElementById("workspace")!, document.getElementById("divider")!);
setupScrollSync(view, preview);

// ---------------------------------------------------------------------------
// 新規 / 開く / 保存 / 名前を付けて保存(すべてタブ単位の操作)
// ---------------------------------------------------------------------------
function doNew(): void {
  const previousId = store.activeDoc().id;
  const doc = store.openUntitled();
  switchEditorTo(doc.id, previousId);
}

async function doOpen(): Promise<void> {
  const path = await open({
    multiple: false,
    filters: [{ name: "AsciiDoc", extensions: ["adoc", "asciidoc", "asc", "txt"] }],
  });
  if (!path || Array.isArray(path)) return;
  await openFileInTab(path);
}

/** ファイルをタブとして開く(保管庫のファイルツリーからも使う) */
async function openFileInTab(path: string): Promise<void> {
  const previousId = store.activeDoc().id;
  const content = await readTextFile(path);
  const { doc, alreadyOpen } = store.openFile(path, content);
  if (alreadyOpen && doc.id === previousId) return;
  // 既存タブなら編集中の内容(EditorState)をそのまま活かす
  switchEditorTo(doc.id, previousId);
}

async function doSave(): Promise<void> {
  const active = store.activeDoc();
  if (!active.path) {
    await doSaveAs();
    return;
  }
  const doc = view.state.doc.toString();
  await writeTextFile(active.path, doc);
  store.markSaved(active.id, doc);
  updateTabs();
}

async function doSaveAs(): Promise<void> {
  const active = store.activeDoc();
  const doc = view.state.doc.toString();
  const path = await save({
    filters: [{ name: "AsciiDoc", extensions: ["adoc"] }],
    defaultPath: active.path,
  });
  if (!path) return;
  await writeTextFile(path, doc);
  store.markSaved(active.id, doc, path);
  updateTabs();
}

// ---------------------------------------------------------------------------
// HTML / PDF エクスポート
// ---------------------------------------------------------------------------
async function exportHtml(): Promise<void> {
  const html = convertToStandaloneHtml(view.state.doc.toString());
  const path = await save({
    filters: [{ name: "HTML", extensions: ["html"] }],
    defaultPath: suggestedExportName(store.activeDoc().path, "html"),
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
document.getElementById("btn-new")!.addEventListener("click", () => doNew());
document.getElementById("btn-open")!.addEventListener("click", () => void doOpen());
document.getElementById("btn-open-folder")!.addEventListener("click", () => void doOpenFolder());
document.getElementById("btn-vault-refresh")!.addEventListener("click", () => void refreshVault());
document.getElementById("btn-save")!.addEventListener("click", () => void doSave());
document.getElementById("btn-save-as")!.addEventListener("click", () => void doSaveAs());
document.getElementById("btn-export-html")!.addEventListener("click", () => void exportHtml());
document.getElementById("btn-export-pdf")!.addEventListener("click", () => exportPdf());

setupShortcuts({
  onNew: doNew,
  onOpen: () => void doOpen(),
  onSave: () => void doSave(),
  onSaveAs: () => void doSaveAs(),
  onPrint: exportPdf,
  onCloseTab: () => void closeTab(store.activeDoc().id),
  onNextTab: () => {
    const previousId = store.activeDoc().id;
    store.activateNext();
    const nextId = store.activeDoc().id;
    if (nextId !== previousId) switchEditorTo(nextId, previousId);
  },
});
