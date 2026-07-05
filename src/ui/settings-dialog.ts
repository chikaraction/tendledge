// 設定モーダルの DOM 接続と永続化。
// スキーマ・検証ロジックは core/settings.ts、ここは <dialog> の描画と
// tauri-plugin-store とのやり取り(ブラウザプレビューでは失敗するので
// インメモリにフォールバックする)を担う。
import { load, type Store } from "@tauri-apps/plugin-store";
import { DEFAULT_SETTINGS, mergeSettings, type Settings, type Theme } from "../core/settings";

const STORE_FILENAME = "settings.json";
const STORE_KEY = "settings";

let store: Store | undefined;
let storeUnavailable = false;
// Tauri 環境が使えない(ブラウザプレビュー)場合のインメモリ代替
let memoryFallback: Settings | undefined;

async function getStore(): Promise<Store | undefined> {
  if (store) return store;
  if (storeUnavailable) return undefined;
  try {
    store = await load(STORE_FILENAME);
    return store;
  } catch (err) {
    // plugin-store は Tauri のネイティブシェルがないと初期化に失敗する。
    // ブラウザプレビューでも既存機能が動く設計を保つため、インメモリ動作に劣化させる。
    // 失敗を覚えておき、呼び出しごとの再試行と警告の連発を避ける。
    storeUnavailable = true;
    console.warn("設定の永続化に失敗したため、インメモリで動作します", err);
    return undefined;
  }
}

/** 保存済み設定を読み込む(失敗時・未保存時はデフォルト) */
export async function loadSettings(): Promise<Settings> {
  const s = await getStore();
  if (!s) return memoryFallback ?? { ...DEFAULT_SETTINGS };
  const saved = await s.get(STORE_KEY);
  return mergeSettings(saved);
}

/** 設定を保存する(ブラウザプレビューではインメモリに保持するだけ) */
export async function saveSettings(settings: Settings): Promise<void> {
  const s = await getStore();
  if (!s) {
    memoryFallback = settings;
    return;
  }
  await s.set(STORE_KEY, settings);
  await s.save();
}

export interface SettingsDialogController {
  open(): void;
}

/**
 * 設定ダイアログを構築する。フィールドの変更は即時に onChange へ通知される
 * (OK ボタン待ちにしない)。onChange 側で適用 + 保存の両方を行う想定。
 * getCurrent は「いま適用されている設定」を返すこと。メニューバーなど
 * ダイアログ以外から設定が変わっても、開き直せば最新値が表示される。
 */
export function createSettingsDialog(
  dialogEl: HTMLDialogElement,
  getCurrent: () => Settings,
  onChange: (settings: Settings) => void,
): SettingsDialogController {
  let settings = { ...getCurrent() };

  dialogEl.innerHTML = "";
  dialogEl.className = "settings-dialog";

  const heading = document.createElement("h2");
  heading.textContent = "設定";
  dialogEl.appendChild(heading);

  const form = document.createElement("form");
  form.method = "dialog";
  form.className = "settings-form";

  // --- テーマ ---
  const themeRow = document.createElement("label");
  themeRow.className = "settings-row";
  const themeSpan = document.createElement("span");
  themeSpan.textContent = "テーマ";
  const themeSelect = document.createElement("select");
  const themeOptions: { value: Theme; label: string }[] = [
    { value: "system", label: "システムに合わせる" },
    { value: "light", label: "ライト" },
    { value: "dark", label: "ダーク" },
  ];
  for (const opt of themeOptions) {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    themeSelect.appendChild(el);
  }
  themeSelect.value = settings.theme;
  themeSelect.addEventListener("change", () => {
    settings = { ...settings, theme: themeSelect.value as Theme };
    onChange(settings);
  });
  themeRow.appendChild(themeSpan);
  themeRow.appendChild(themeSelect);
  form.appendChild(themeRow);

  // --- エディタのフォントサイズ ---
  const fontRow = document.createElement("label");
  fontRow.className = "settings-row";
  const fontSpan = document.createElement("span");
  fontSpan.textContent = "エディタのフォントサイズ (px)";
  const fontInput = document.createElement("input");
  fontInput.type = "number";
  fontInput.min = "10";
  fontInput.max = "24";
  fontInput.step = "1";
  fontInput.value = String(settings.editorFontSize);
  fontInput.addEventListener("change", () => {
    const parsed = mergeSettings({ ...settings, editorFontSize: fontInput.valueAsNumber });
    settings = parsed;
    fontInput.value = String(settings.editorFontSize);
    onChange(settings);
  });
  fontRow.appendChild(fontSpan);
  fontRow.appendChild(fontInput);
  form.appendChild(fontRow);

  // --- プレビューのデバウンス ---
  const debounceRow = document.createElement("label");
  debounceRow.className = "settings-row";
  const debounceSpan = document.createElement("span");
  debounceSpan.textContent = "プレビューのデバウンス (ms)";
  const debounceInput = document.createElement("input");
  debounceInput.type = "number";
  debounceInput.min = "100";
  debounceInput.max = "2000";
  debounceInput.step = "50";
  debounceInput.value = String(settings.previewDebounceMs);
  debounceInput.addEventListener("change", () => {
    const parsed = mergeSettings({
      ...settings,
      previewDebounceMs: debounceInput.valueAsNumber,
    });
    settings = parsed;
    debounceInput.value = String(settings.previewDebounceMs);
    onChange(settings);
  });
  debounceRow.appendChild(debounceSpan);
  debounceRow.appendChild(debounceInput);
  form.appendChild(debounceRow);

  const footer = document.createElement("div");
  footer.className = "settings-footer";
  const closeButton = document.createElement("button");
  closeButton.type = "submit";
  closeButton.textContent = "閉じる";
  footer.appendChild(closeButton);
  form.appendChild(footer);

  dialogEl.appendChild(form);

  return {
    open() {
      // 開くたびに「いま適用されている設定」をフォームへ反映する
      settings = { ...getCurrent() };
      themeSelect.value = settings.theme;
      fontInput.value = String(settings.editorFontSize);
      debounceInput.value = String(settings.previewDebounceMs);
      dialogEl.showModal();
    },
  };
}
