// 合成ルート: DOM の取得と各モジュールの接続だけを行う。
// ロジックは core/(純粋関数)、DOM 操作は ui/、変換は render.ts に置く。
import type { EditorState } from "@codemirror/state";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { createDocumentStore } from "./core/documents";
import { basename, joinPath, suggestedExportName } from "./core/paths";
import { resolveImagePath } from "./core/preview-links";
import { DEFAULT_SETTINGS, type Settings, type Theme } from "./core/settings";
import {
  createViewModeState,
  setMode,
  togglePreview,
  toggleSplit,
  type ViewModeState,
} from "./core/view-mode";
import { buildVaultTree, type RawEntry } from "./core/vault-tree";
import { convertToStandaloneHtml } from "./render";
import { sampleDoc } from "./sample-doc";
import { setupDivider } from "./ui/divider";
import { createEditor, editorScrollToLine, editorTopLine } from "./ui/editor";
import { createFileTree } from "./ui/file-tree";
import { icon, icons } from "./ui/icons";
import { createMenubar } from "./ui/menubar";
import { createPreview } from "./ui/preview";
import { setupPreviewLinks } from "./ui/preview-links";
import { setupScrollSync } from "./ui/scroll-sync";
import {
  createSettingsDialog,
  loadSettings,
  saveSettings,
  type SettingsDialogController,
} from "./ui/settings-dialog";
import { setupShortcuts } from "./ui/shortcuts";
import { createStatusbar } from "./ui/statusbar";
import { renderTabs } from "./ui/tabs";
import { createViewModeControls } from "./ui/view-mode";

// ---------------------------------------------------------------------------
// DOM 要素
// ---------------------------------------------------------------------------
const previewEl = document.getElementById("preview")!;
const previewPaneEl = document.getElementById("preview-pane")!;
const tabbarTabsEl = document.getElementById("tabbar-tabs")!;
const tabbarActionsEl = document.getElementById("tabbar-actions")!;
const sidebarEl = document.getElementById("sidebar")!;
const vaultNameEl = document.getElementById("vault-name")!;

const statusbar = createStatusbar(document.getElementById("statusbar")!);

// ---------------------------------------------------------------------------
// ドキュメント(タブ)状態とエディタ
// ---------------------------------------------------------------------------
const store = createDocumentStore({ initialContent: sampleDoc });

// タブごとの EditorState(undo 履歴・カーソル位置を保持)。キーはドキュメント ID。
const editorStates = new Map<number, EditorState>();

const preview = createPreview({
  previewEl,
  paneEl: previewPaneEl,
  statusEl: statusbar.convertStatusEl,
  resolveImageSrc: (src) => {
    const path = resolveImagePath(src, store.activeDoc().path);
    if (!path) return undefined;
    try {
      // Tauri の asset プロトコル URL へ変換(ブラウザプレビューでは使えないのでそのまま)
      return convertFileSrc(path);
    } catch {
      return undefined;
    }
  },
});

const editor = createEditor({
  parent: document.getElementById("editor-pane")!,
  doc: sampleDoc,
  onDocChanged: (doc) => {
    store.updateContent(store.activeDoc().id, doc);
    preview.scheduleRender(doc);
    statusbar.setDocText(doc);
    updateTabs();
  },
  onCursorChanged: (line, col) => statusbar.setCursor(line, col),
});
const view = editor.view;

/** タブ切替直後など、updateListener を経由しない場面でステータスバーを同期する */
function syncStatusbarFromView(): void {
  const doc = view.state.doc;
  const head = view.state.selection.main.head;
  const line = doc.lineAt(head);
  statusbar.setDocText(doc.toString());
  statusbar.setCursor(line.number, head - line.from + 1);
}

function updateTabs(): void {
  renderTabs(tabbarTabsEl, store.list(), store.activeDoc().id, store.isDirty, {
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
  syncStatusbarFromView();
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
  statusbar.setVaultName(basename(vaultPath));
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
syncStatusbarFromView();
updateTabs();
view.focus();

setupDivider(document.getElementById("workspace")!, document.getElementById("divider")!);
setupScrollSync(view, preview);

// ---------------------------------------------------------------------------
// 表示モード(エディタのみ / 分割 / プレビューのみ。ウィンドウ単位で1つ)
// ---------------------------------------------------------------------------
let viewModeState = createViewModeState();

const viewModeControls = createViewModeControls(
  tabbarActionsEl,
  document.getElementById("workspace")!,
  {
    onToggleSplit: () => applyViewMode(toggleSplit(viewModeState)),
    onTogglePreview: () => applyViewMode(togglePreview(viewModeState)),
  },
);
viewModeControls.render(viewModeState);

function applyViewMode(next: ViewModeState): void {
  viewModeState = next;
  viewModeControls.render(viewModeState);
  menubar.refresh();
}

setupPreviewLinks({
  paneEl: previewPaneEl,
  currentDocPath: () => store.activeDoc().path,
  openFile: (path) => {
    openFileInTab(path).catch((err) => console.error("リンク先を開けませんでした:", err));
  },
  openExternal: (url) => {
    // Tauri 実機ではシステムブラウザへ。ブラウザプレビューでは新規タブにフォールバック。
    openUrl(url).catch(() => window.open(url, "_blank", "noopener"));
  },
});

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
// 設定(テーマ・エディタのフォントサイズ・プレビューのデバウンス)
// ---------------------------------------------------------------------------
// 「いま適用されている設定」の唯一の置き場。ダイアログとメニューバーの両方から
// updateSettings() 経由で更新される。
let currentSettings: Settings = { ...DEFAULT_SETTINGS };
let settingsDialog: SettingsDialogController | undefined;

/** 設定を DOM/プレビューへ適用する(見た目・挙動の反映のみ。保存はしない) */
function applySettings(settings: Settings): void {
  if (settings.theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }
  document.documentElement.style.setProperty("--editor-font-size", `${settings.editorFontSize}px`);
  document.documentElement.style.setProperty(
    "--preview-font-size",
    `${settings.previewFontSize}px`,
  );
  // フォントファミリ未指定(空)のときは変数ごと外して CSS 側のフォールバックに任せる
  // (空文字列を設定すると var() の第2引数が使われず、フォント指定が無効になるため)
  if (settings.editorFontFamily) {
    document.documentElement.style.setProperty("--editor-font-family", settings.editorFontFamily);
  } else {
    document.documentElement.style.removeProperty("--editor-font-family");
  }
  if (settings.previewFontFamily) {
    document.documentElement.style.setProperty(
      "--preview-font-family",
      settings.previewFontFamily,
    );
  } else {
    document.documentElement.style.removeProperty("--preview-font-family");
  }
  preview.setDebounceMs(settings.previewDebounceMs);
}

function updateSettings(next: Settings): void {
  currentSettings = next;
  applySettings(next);
  void saveSettings(next);
  menubar.refresh(); // テーマのチェックマーク表示を追従させる
}

function setTheme(theme: Theme): void {
  updateSettings({ ...currentSettings, theme });
}

async function initSettings(): Promise<void> {
  currentSettings = await loadSettings();
  applySettings(currentSettings);
  settingsDialog = createSettingsDialog(
    document.getElementById("settings-dialog") as HTMLDialogElement,
    () => currentSettings,
    updateSettings,
  );
}

// ---------------------------------------------------------------------------
// メニューバーとショートカット
// ---------------------------------------------------------------------------
const menubar = createMenubar(document.getElementById("menubar")!, [
  {
    id: "file",
    label: "ファイル",
    entries: [
      { label: "新規", shortcut: "Ctrl+N", onSelect: doNew },
      { label: "開く...", shortcut: "Ctrl+O", onSelect: () => void doOpen() },
      { label: "フォルダを開く...", onSelect: () => void doOpenFolder() },
      "separator",
      { label: "保存", shortcut: "Ctrl+S", onSelect: () => void doSave() },
      { label: "名前を付けて保存...", shortcut: "Ctrl+Shift+S", onSelect: () => void doSaveAs() },
      "separator",
      { label: "HTML としてエクスポート...", onSelect: () => void exportHtml() },
      { label: "PDF / 印刷...", shortcut: "Ctrl+P", onSelect: exportPdf },
      "separator",
      { label: "設定...", onSelect: () => settingsDialog?.open() },
    ],
  },
  {
    id: "view",
    label: "表示",
    entries: [
      {
        label: "サイドバー",
        checked: () => !sidebarEl.hidden,
        onSelect: () => {
          sidebarEl.hidden = !sidebarEl.hidden;
        },
      },
      "separator",
      {
        label: "エディタのみ",
        checked: () => viewModeState.mode === "editor",
        onSelect: () => applyViewMode(setMode(viewModeState, "editor")),
      },
      {
        label: "分割",
        shortcut: "Ctrl+K V",
        checked: () => viewModeState.mode === "split",
        onSelect: () => applyViewMode(setMode(viewModeState, "split")),
      },
      {
        label: "プレビューのみ",
        shortcut: "Ctrl+Shift+V",
        checked: () => viewModeState.mode === "preview",
        onSelect: () => applyViewMode(setMode(viewModeState, "preview")),
      },
      "separator",
      {
        label: "テーマ: システムに合わせる",
        checked: () => currentSettings.theme === "system",
        onSelect: () => setTheme("system"),
      },
      {
        label: "テーマ: ライト",
        checked: () => currentSettings.theme === "light",
        onSelect: () => setTheme("light"),
      },
      {
        label: "テーマ: ダーク",
        checked: () => currentSettings.theme === "dark",
        onSelect: () => setTheme("dark"),
      },
    ],
  },
]);

void initSettings();

const vaultRefreshBtn = document.getElementById("btn-vault-refresh")!;
vaultRefreshBtn.replaceChildren(icon(icons.refresh, 13));
vaultRefreshBtn.addEventListener("click", () => void refreshVault());

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
  onToggleSplit: () => applyViewMode(toggleSplit(viewModeState)),
  onTogglePreview: () => applyViewMode(togglePreview(viewModeState)),
});
