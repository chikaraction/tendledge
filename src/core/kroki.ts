// Kroki(PlantUML / Draw.io)まわりの純粋ロジック。DOM / fetch には依存しない。

/** プレビューが Kroki 経由でレンダリングを試みる data-lang 値の一覧 */
export const KROKI_LANGS = ["plantuml", "drawio"] as const;

/**
 * data-lang(このアプリでの呼称)から Kroki API の図種別名を解決する。
 * drawio は Kroki 側では diagramsnet という呼称のため変換が要る。
 * KROKI_LANGS に含まれない言語は undefined を返す。
 */
export function krokiDiagramType(lang: string): string | undefined {
  if (lang === "plantuml") return "plantuml";
  if (lang === "drawio") return "diagramsnet";
  return undefined;
}

/**
 * サーバー URL と言語からリクエスト URL を組み立てる。
 * 対応外の言語では undefined を返す(呼び出し側で送信をスキップさせる)。
 */
export function krokiRequestUrl(serverUrl: string, lang: string): string | undefined {
  const type = krokiDiagramType(lang);
  if (!type) return undefined;
  const base = serverUrl.replace(/\/+$/, "");
  return `${base}/${type}/svg`;
}

/**
 * レンダリング結果(SVG)のキャッシュキー。
 * サーバー URL を含めるのは、self-host 先の切り替え後に別サーバーの
 * 結果を誤って返さないため。Kroki の SVG はテーマ非依存なのでテーマは含めない。
 */
export function krokiCacheKey(serverUrl: string, lang: string, source: string): string {
  return `${serverUrl} ${lang} ${source}`;
}

/**
 * SVG 文字列を data URI に変換する(<img src="..."> での挿入用)。
 * btoa はマルチバイト文字を扱えないため、UTF-8 バイト列に変換してから base64 化する。
 */
export function svgToDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
