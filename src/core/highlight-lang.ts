// シンタックスハイライトの対応言語判定(純粋ロジック)。
// highlight.js 本体・DOM には依存しない。ui/code-highlight.ts が
// SUPPORTED_LANGUAGES を使って hljs へ言語モジュールを登録し、
// resolveHighlightLanguage の解決結果でハイライト対象かどうかを判断する。

/** hljs に登録する言語モジュール名(= 正規名)の一覧 */
export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "json",
  "xml",
  "css",
  "bash",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "ruby",
  "sql",
  "yaml",
  "ini",
  "diff",
  "dockerfile",
  "kotlin",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// data-lang の表記ゆれ → 正規名。mermaid は図として別処理するためここには含めない
// (未対応言語として resolveHighlightLanguage が undefined を返す)。
const ALIASES: Record<string, SupportedLanguage> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  html: "xml",
  svg: "xml",
  xhtml: "xml",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  "c++": "cpp",
  "c#": "csharp",
  toml: "ini",
  docker: "dockerfile",
};

const SUPPORTED_SET: ReadonlySet<string> = new Set(SUPPORTED_LANGUAGES);

/**
 * コードブロックの data-lang 属性値から、ハイライトに使う正規言語名を解決する。
 * 対応外の言語・null・空文字は undefined を返し、呼び出し側はプレーン表示にする。
 */
export function resolveHighlightLanguage(dataLang: string | null): SupportedLanguage | undefined {
  if (!dataLang) return undefined;
  const normalized = dataLang.trim().toLowerCase();
  if (!normalized) return undefined;
  if (SUPPORTED_SET.has(normalized)) return normalized as SupportedLanguage;
  return ALIASES[normalized];
}
