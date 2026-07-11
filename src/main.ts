// 合成ルート: DOM の取得と各モジュールの接続だけを行う。
// ロジックは core/(純粋関数)、DOM 操作は ui/、変換は render.ts に置く。
import type { EditorState } from "@codemirror/state";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import { type MermaidTheme, resolveMermaidTheme } from "./core/diagram";
import { createDocumentStore } from "./core/documents";
import { basename, joinPath, suggestedExportName } from "./core/paths";
import { resolveImagePath } from "./core/preview-links";
import {
  DEFAULT_SETTINGS,
  PREVIEW_MAX_WIDTH_CSS,
  type Settings,
  type Theme,
} from "./core/settings";
import {
  createViewModeState,
  setMode,
  togglePreview,
  toggleSplit,
  type ViewModeState,
} from "./core/view-mode";
import { buildVaultTree, countFiles, exceedsMaxVaultDepth, type RawEntry } from "./core/vault-tree";
import { sampleDoc } from "./sample-doc";
import { alertDialog, confirmDialog } from "./ui/dialogs";
import { setupDivider } from "./ui/divider";
import { createEditor, editorScrollToLine, editorTopLine, openEditorSearch } from "./ui/editor";
import { createFileTree } from "./ui/file-tree";
import { buildExportHtml } from "./ui/html-export";
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
import { renderTabs, setupTabOverflow } from "./ui/tabs";
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
const vaultFileCountEl = document.getElementById("vault-file-count")!;

const statusbar = createStatusbar(document.getElementById("statusbar")!);

// 「いま適用されている設定」の唯一の置き場。ダイアログとメニューバーの両方から
// updateSettings() 経由で更新される。プレビューの初期描画(モジュール評価中)が
// mermaid テーマ解決で参照するため、配線より前に宣言しておく必要がある。
let currentSettings: Settings = { ...DEFAULT_SETTINGS };
// テーマ "system" のときの実効テーマ判定(mermaid 図のテーマ解決に使う)
const prefersDarkMedia = window.matchMedia("(prefers-color-scheme: dark)");
// 直近でプレビューに焼き込んだ mermaid テーマ。これが変わったら図を描き直す
// (配色が SVG に焼き込まれるため CSS では追従できない)。初回描画はデフォルト設定で
// 走るので、その実効テーマで初期化しておく。
let lastMermaidTheme: MermaidTheme = resolveMermaidTheme(
  DEFAULT_SETTINGS.theme,
  prefersDarkMedia.matches,
);

// ---------------------------------------------------------------------------
// ドキュメント(タブ)状態とエディタ
// ---------------------------------------------------------------------------
const store = createDocumentStore({ initialContent: sampleDoc });

// タブごとの EditorState(undo 履歴・カーソル位置を保持)。キーはドキュメント ID。
const editorStates = new Map<number, EditorState>();

// タブごとのスクロール位置。EditorState はスクロール位置を含まないため、
// setState だけだと前のタブの scrollTop が新しいタブに引き継がれてしまう。
const tabScrollTops = new Map<number, { editor: number; preview: number }>();

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
  // mermaid の配色は SVG に焼き込まれるため、描画時点の実効テーマを毎回解決する。
  // 印刷時だけは mermaidThemeOverride でライト(default)に一時上書きする。
  mermaidTheme: () =>
    mermaidThemeOverride ?? resolveMermaidTheme(currentSettings.theme, prefersDarkMedia.matches),
  kroki: () => ({
    enabled: currentSettings.krokiEnabled,
    serverUrl: currentSettings.krokiServerUrl,
  }),
});
// 印刷前の一時テーマ上書き(exportPdf が設定/解除する)
let mermaidThemeOverride: MermaidTheme | undefined;

const editor = createEditor({
  parent: document.getElementById("editor-pane")!,
  doc: sampleDoc,
  onDocChanged: (doc) => {
    // タブバーの全再構築(renderTabs + tabOverflow.update の強制レイアウト)は
    // dirty ドットの表示が変わるとき(dirty 状態遷移)だけ必要。入力のたびに
    // 呼ぶとキーストローク毎に無駄な再描画が走るため、更新有無を updateContent の
    // 戻り値で判定する。
    const dirtyChanged = store.updateContent(store.activeDoc().id, doc);
    preview.scheduleRender(doc);
    statusbar.setDocText(doc);
    if (dirtyChanged) updateTabs();
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

const tabOverflow = setupTabOverflow(
  document.getElementById("tabbar")!,
  tabbarTabsEl,
  () =>
    store.list().map((d) => ({
      id: d.id,
      label: d.path ? basename(d.path) : "Untitled",
      active: d.id === store.activeDoc().id,
      dirty: store.isDirty(d.id),
    })),
  (id) => activateTab(id),
);

function updateTabs(): void {
  renderTabs(tabbarTabsEl, store.list(), store.activeDoc().id, store.isDirty, {
    onActivate: activateTab,
    onClose: (id) => void closeTab(id),
  });
  tabOverflow.update();
}

// 素早い連続タブ切替(A→B→C)で、後から解決した古い .then() が新しいタブの
// プレビュー scrollTop を上書きしてしまわないためのガード。switchEditorTo が
// 呼ばれるたびに進み、.then() 側は「自分が最新の切替か」をこれで確認する。
let scrollRestoreGeneration = 0;

/** アクティブタブの EditorState を退避してから、指定タブの状態に切り替える */
function switchEditorTo(id: number, previousId?: number): void {
  // 切替の間はスクロール同期を止める。setState でエディタの内容量が変わると
  // ブラウザが scrollTop を新しい範囲へ自動クランプすることがあり、その瞬間に
  // 同期リスナーが発火すると「プレビューはまだ前のタブの見出しアンカーのまま」
  // という食い違った状態で計算してしまい、誤った位置に飛んでしまう
  // (しかもその後の正しい修正が二重発火防止ガードでブロックされて残ってしまう)。
  const resumeScrollSync = scrollSync.suspend();
  if (previousId !== undefined && previousId !== id) {
    editorStates.set(previousId, view.state);
    tabScrollTops.set(previousId, {
      editor: view.scrollDOM.scrollTop,
      preview: preview.paneEl.scrollTop,
    });
  }
  const doc = store.list().find((d) => d.id === id)!;
  const state = editorStates.get(id) ?? editor.newState(doc.content);
  view.setState(state);
  // view.focus() は CodeMirror 内部に「フォーカス時に scrollTop が 0 なら
  // 直前の scrollTop(inputState.lastScrollTop)へ戻す」処理を持つ
  // (@codemirror/view の observers.focus)。inputState は setState をまたいで
  // 保持されるので、focus をこの後(scrollTop 確定後)に呼ぶと、古いタブの
  // 位置へ巻き戻されてしまう。先に focus してから scrollTop を確定させる。
  view.focus();
  const scroll = tabScrollTops.get(id);
  view.scrollDOM.scrollTop = scroll?.editor ?? 0;
  // render() の innerHTML 差し替え自体は同期実行される(mermaid/Kroki の非同期完了を
  // 待つ必要があるのは decorateDiagrams だけ)。呼び出し直後に scrollTop を復元すれば、
  // 新しいタブのアンカーに対して正しい位置が決まる。.then() まで待つと、素早い連続切替
  // (A→B→C)で後発の解決が先発を追い越し、表示中のタブに別タブの位置を適用してしまう
  // 競合があったため、同期復元を主経路にした。
  const generation = ++scrollRestoreGeneration;
  const renderDone = preview.render(view.state.doc.toString());
  preview.paneEl.scrollTop = scroll?.preview ?? 0;
  // 図の非同期完了でアンカーが再構築され、prewview の scrollTop がずれる可能性が
  // あるための後始末。ただし自分より新しい切替が既に走っていたら(generation不一致)
  // その切替のプレビューを上書きしないよう再適用はスキップする。スクロール同期の
  // 再開(resumeScrollSync)は suspend とペアで必ず呼ぶ(カウント方式のため)。
  void renderDone.then(() => {
    if (generation === scrollRestoreGeneration) {
      preview.paneEl.scrollTop = scroll?.preview ?? 0;
    }
    resumeScrollSync();
  });
  syncStatusbarFromView();
  updateTabs();
  fileTree.setActivePath(doc.path);
}

function activateTab(id: number): void {
  const previousId = store.activeDoc().id;
  if (id === previousId) return;
  store.activate(id);
  switchEditorTo(id, previousId);
}

async function closeTab(id: number): Promise<void> {
  if (store.isDirty(id)) {
    // window.confirm は Tauri 実機(wry)では表示されず素通りするため使わない(ui/dialogs.ts 参照)
    const ok = await confirmDialog(
      "保存されていない変更があります。破棄してタブを閉じますか?",
      "タブを閉じる",
    );
    if (!ok) return;
  }
  const previousId = store.activeDoc().id;
  editorStates.delete(id);
  tabScrollTops.delete(id);
  store.close(id);
  const nextActive = store.activeDoc().id;
  if (previousId === id || nextActive !== previousId) {
    switchEditorTo(nextActive);
  } else {
    updateTabs();
  }
}

// ウィンドウの✕ボタンでは Ctrl+W と違って確認なしに閉じてしまう(未保存データが
// 無言で消える)ため、Tauri 実機は onCloseRequested、ブラウザプレビューは
// beforeunload でそれぞれガードする。両方登録すると実機で確認が二重に出るため分岐する。
if (isTauri()) {
  // onCloseRequested は async ハンドラの解決を待ってから destroy を判断するため、
  // plugin-dialog の confirm を await してから preventDefault できる(公式の推奨パターン)。
  // window.confirm は実機(wry)では表示されず素通りする(ui/dialogs.ts 参照)。
  void getCurrentWindow().onCloseRequested(async (event) => {
    if (!store.hasDirty()) return;
    const ok = await confirmDialog(
      "保存されていない変更があります。保存せずにアプリを終了しますか?",
      "アプリを終了",
    );
    if (!ok) event.preventDefault();
  });
} else {
  // beforeunload 内での window.confirm は主要ブラウザが無視するため使えない。
  // 標準の作法どおり preventDefault + returnValue でブラウザ既定の確認ダイアログに委ねる
  // (文言はセキュリティ上の理由で主要ブラウザが独自メッセージに差し替える)。
  window.addEventListener("beforeunload", (event) => {
    if (!store.hasDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

// ---------------------------------------------------------------------------
// 保管庫(フォルダを開いてファイルツリーから編集対象を選ぶ)
// ---------------------------------------------------------------------------
let vaultPath: string | undefined;

const fileTree = createFileTree(document.getElementById("file-tree")!, (path) => {
  openFileInTab(path).catch((err) => {
    console.error("ファイルを開けませんでした:", path, err);
    void alertDialog(`ファイルを開けませんでした:\n${path}\n\n${err}`, "エラー");
  });
});

/**
 * readDir を再帰的に呼んでツリーの素材を集める(ドット始まりのフォルダには潜らない)。
 * サブフォルダの readDir が失敗しても(アクセス拒否等)そのフォルダをスキップして
 * 残りは表示する。深さ上限(MAX_VAULT_DEPTH)を超えたら潜らずに空扱いにする
 * (Windows のジャンクション/シンボリックリンクの循環で無限再帰しないための安全弁)。
 */
async function walkDir(path: string, depth = 0): Promise<RawEntry[]> {
  if (exceedsMaxVaultDepth(depth)) return [];
  let entries: Awaited<ReturnType<typeof readDir>>;
  try {
    entries = await readDir(path);
  } catch (err) {
    console.error("フォルダを読み込めませんでした(スキップします):", path, err);
    return [];
  }
  return Promise.all(
    entries.map(async (e): Promise<RawEntry> => {
      if (e.isDirectory && !e.name.startsWith(".")) {
        return {
          name: e.name,
          isDirectory: true,
          children: await walkDir(joinPath(path, e.name), depth + 1),
        };
      }
      return { name: e.name, isDirectory: e.isDirectory };
    }),
  );
}

async function refreshVault(): Promise<void> {
  if (!vaultPath) return;
  try {
    const entries = await walkDir(vaultPath);
    const tree = buildVaultTree(vaultPath, entries);
    fileTree.setTree(tree);
    fileTree.setActivePath(store.activeDoc().path);
    vaultNameEl.textContent = basename(vaultPath);
    vaultNameEl.title = vaultPath;
    const fileCount = countFiles(tree);
    vaultFileCountEl.textContent = `${fileCount} ファイル`;
    statusbar.setVaultName(basename(vaultPath));
    sidebarEl.hidden = false;
  } catch (err) {
    console.error("保管庫を読み込めませんでした:", vaultPath, err);
    await alertDialog(`保管庫を読み込めませんでした:\n${vaultPath}\n\n${err}`, "エラー");
  }
}

async function doOpenFolder(): Promise<void> {
  const path = await open({ directory: true, title: "保管庫にするフォルダを選択" });
  if (!path || Array.isArray(path)) return;
  vaultPath = path;
  await refreshVault();
}

// 初回描画(デバウンスなしで即時)
void preview.render(view.state.doc.toString());
syncStatusbarFromView();
updateTabs();
view.focus();

setupDivider(document.getElementById("workspace")!, document.getElementById("divider")!);
const scrollSync = setupScrollSync(view, preview);

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

/** モード切替で再表示されたペインを、もう一方の現在位置に合わせて一度だけスクロール同期する */
function syncScrollOnModeChange(previousMode: ViewModeState["mode"], nextMode: ViewModeState["mode"]): void {
  if (previousMode === nextMode) return;
  if (previousMode === "editor" && nextMode !== "editor") {
    // プレビューが再表示された: エディタの現在位置に合わせる
    preview.paneEl.scrollTop = preview.scrollTopForLine(editorTopLine(view), view.state.doc.lines);
  } else if (previousMode === "preview" && nextMode !== "preview") {
    // エディタが再表示された: プレビューだけ読み進めた位置を引き継ぐ
    editorScrollToLine(view, preview.lineForScrollTop(preview.paneEl.scrollTop, view.state.doc.lines));
  }
}

function applyViewMode(next: ViewModeState): void {
  const previousMode = viewModeState.mode;
  viewModeState = next;
  viewModeControls.render(viewModeState);
  menubar.refresh();
  syncScrollOnModeChange(previousMode, viewModeState.mode);
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
  // 保存先ダイアログを先に出す。buildExportHtml は Kroki 有効時に文書内容を
  // 外部サーバーへ送信するため、キャンセル時に送信が発生しないよう
  // 「パスが決まってから生成する」順序にしている。
  const path = await save({
    filters: [{ name: "HTML", extensions: ["html"] }],
    defaultPath: suggestedExportName(store.activeDoc().path, "html"),
  });
  if (!path) return;
  const html = await buildExportHtml(view.state.doc.toString(), {
    enabled: currentSettings.krokiEnabled,
    serverUrl: currentSettings.krokiServerUrl,
  });
  await writeTextFile(path, html);
}

async function exportPdf(): Promise<void> {
  // 実際の書き出しはブラウザ/OSの印刷ダイアログ(「PDFとして保存」)に委ねる。
  // 対象コンテンツの絞り込みは styles.css の @media print が担う。
  // @media print はライト配色を強制するが、ダークで焼き込み済みの mermaid SVG は
  // ダークのまま出てしまう。印刷前に default テーマで図を描き直し、印刷後に戻す。
  const needsSwap =
    resolveMermaidTheme(currentSettings.theme, prefersDarkMedia.matches) === "dark";
  if (needsSwap) {
    mermaidThemeOverride = "default";
    await preview.render(view.state.doc.toString());
  }
  window.print();
  if (needsSwap) {
    mermaidThemeOverride = undefined;
    await preview.render(view.state.doc.toString());
  }
}

// ---------------------------------------------------------------------------
// 設定(テーマ・エディタのフォントサイズ・プレビューのデバウンス)
// ---------------------------------------------------------------------------
// currentSettings の宣言はファイル冒頭(プレビュー配線の前)にある
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
  // mermaid 図は SVG に寸法が焼き込まれておりフォントサイズ変数では伸縮しないため、
  // 既定 16px に対する倍率を渡して図全体を拡大縮小させる(styles.css の zoom)
  document.documentElement.style.setProperty(
    "--diagram-scale",
    String(settings.previewFontSize / DEFAULT_SETTINGS.previewFontSize),
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
  // プレビュー本文の最大幅。standard は変数ごと外して CSS 側のフォールバック(46rem)に任せる
  const previewMaxWidth = PREVIEW_MAX_WIDTH_CSS[settings.previewMaxWidth];
  if (previewMaxWidth) {
    document.documentElement.style.setProperty("--preview-max-width", previewMaxWidth);
  } else {
    document.documentElement.style.removeProperty("--preview-max-width");
  }
  preview.setDebounceMs(settings.previewDebounceMs);
  rerenderPreviewIfMermaidThemeChanged();
  rerenderPreviewIfKrokiConfigChanged();
}

/** mermaid の実効テーマが前回描画時から変わっていたら、図を描き直す */
function rerenderPreviewIfMermaidThemeChanged(): void {
  const next = resolveMermaidTheme(currentSettings.theme, prefersDarkMedia.matches);
  if (next === lastMermaidTheme) return;
  lastMermaidTheme = next;
  void preview.render(view.state.doc.toString());
}

// 直近でプレビューに使った Kroki 設定。有効化・サーバー URL の変更を検知して
// 図を描き直す(オフのままなら再描画は不要)ためのキー。
let lastKrokiConfigKey = `${DEFAULT_SETTINGS.krokiEnabled} ${DEFAULT_SETTINGS.krokiServerUrl}`;

/** Kroki のオプトイン状態・サーバー URL が前回描画時から変わっていたら、図を描き直す */
function rerenderPreviewIfKrokiConfigChanged(): void {
  const next = `${currentSettings.krokiEnabled} ${currentSettings.krokiServerUrl}`;
  if (next === lastKrokiConfigKey) return;
  lastKrokiConfigKey = next;
  void preview.render(view.state.doc.toString());
}

// テーマ "system" のまま OS のダーク設定が切り替わったときも図を追従させる
prefersDarkMedia.addEventListener("change", rerenderPreviewIfMermaidThemeChanged);

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
      {
        label: "HTML としてエクスポート...",
        title: "現在のテーマ設定に関わらず、常にライト配色で出力されます",
        onSelect: () => void exportHtml(),
      },
      {
        label: "PDF / 印刷...",
        shortcut: "Ctrl+P",
        title: "現在のテーマ設定に関わらず、常にライト配色で出力されます",
        onSelect: () => void exportPdf(),
      },
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
  onPrint: () => void exportPdf(),
  onCloseTab: () => void closeTab(store.activeDoc().id),
  onNextTab: () => {
    const previousId = store.activeDoc().id;
    store.activateNext();
    const nextId = store.activeDoc().id;
    if (nextId !== previousId) switchEditorTo(nextId, previousId);
  },
  onToggleSplit: () => applyViewMode(toggleSplit(viewModeState)),
  onTogglePreview: () => applyViewMode(togglePreview(viewModeState)),
  onFind: () => {
    // プレビューのみ表示中はエディタが非表示なので、ネイティブ検索バーに任せる。
    // それ以外(エディタ表示中)はプレビューにフォーカスがあっても検索パネルを開く。
    if (viewModeState.mode === "preview") return false;
    openEditorSearch(view);
    return true;
  },
});
