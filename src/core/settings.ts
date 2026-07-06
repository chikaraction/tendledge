// 設定スキーマ・デフォルト値・保存値とのマージ(純粋ロジック。DOM / Tauri に依存しない)
//
// 保存値は tauri-plugin-store から読み出した「型不明の JSON」なので、
// mergeSettings は不正な値・欠けたキーをすべてデフォルトにフォールバックさせる。
// 新しい設定項目を増やすときは Settings / DEFAULT_SETTINGS / mergeSettings の 3 箇所を揃えて拡張する。

export type Theme = "light" | "dark" | "system";

export interface Settings {
  /** 配色テーマ */
  theme: Theme;
  /** エディタのフォントサイズ(px) */
  editorFontSize: number;
  /** エディタのフォントファミリ(空文字列 = アプリ既定) */
  editorFontFamily: string;
  /** プレビューのフォントサイズ(px) */
  previewFontSize: number;
  /** プレビューのフォントファミリ(空文字列 = アプリ既定) */
  previewFontFamily: string;
  /** プレビュー再描画のデバウンス時間(ms) */
  previewDebounceMs: number;
}

const THEMES: readonly Theme[] = ["light", "dark", "system"];

const FONT_SIZE_MIN = 9;
const FONT_SIZE_MAX = 72;

const FONT_FAMILY_MAX_LENGTH = 200;

const DEBOUNCE_MS_MIN = 100;
const DEBOUNCE_MS_MAX = 2000;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  editorFontSize: 14,
  editorFontFamily: "",
  previewFontSize: 16,
  previewFontFamily: "",
  previewDebounceMs: 300,
};

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && !Number.isNaN(value) && value >= min && value <= max;
}

/** フォントファミリとして妥当なら前後空白を除いた値を、そうでなければ既定値を返す */
function mergeFontFamily(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length <= FONT_FAMILY_MAX_LENGTH ? trimmed : fallback;
}

/**
 * 保存値(型不明の JSON)を検証し、不正な値・欠けたキーはデフォルトにフォールバックする。
 * オブジェクトでない値(null / 配列 / プリミティブなど)を渡した場合はすべてデフォルトを返す。
 */
export function mergeSettings(saved: unknown): Settings {
  if (typeof saved !== "object" || saved === null || Array.isArray(saved)) {
    return { ...DEFAULT_SETTINGS };
  }
  const candidate = saved as Record<string, unknown>;
  return {
    theme: isTheme(candidate.theme) ? candidate.theme : DEFAULT_SETTINGS.theme,
    editorFontSize: isNumberInRange(candidate.editorFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX)
      ? candidate.editorFontSize
      : DEFAULT_SETTINGS.editorFontSize,
    editorFontFamily: mergeFontFamily(
      candidate.editorFontFamily,
      DEFAULT_SETTINGS.editorFontFamily,
    ),
    previewFontSize: isNumberInRange(candidate.previewFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX)
      ? candidate.previewFontSize
      : DEFAULT_SETTINGS.previewFontSize,
    previewFontFamily: mergeFontFamily(
      candidate.previewFontFamily,
      DEFAULT_SETTINGS.previewFontFamily,
    ),
    previewDebounceMs: isNumberInRange(
      candidate.previewDebounceMs,
      DEBOUNCE_MS_MIN,
      DEBOUNCE_MS_MAX,
    )
      ? candidate.previewDebounceMs
      : DEFAULT_SETTINGS.previewDebounceMs,
  };
}
