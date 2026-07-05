// Asciidoctor.js による変換(プロセッサは1回だけ生成する)
import Asciidoctor from "@asciidoctor/core";

const asciidoctor = Asciidoctor();

const BASE_ATTRIBUTES = {
  showtitle: true, // 文書タイトル(= 見出し)をプレビューに表示
  sectnums: false,
};

/** プレビュー用の HTML 断片に変換する。 */
export function convertToPreviewHtml(source: string): string {
  return asciidoctor.convert(source, {
    safe: "safe",
    attributes: BASE_ATTRIBUTES,
  }) as string;
}

/** エクスポート用のスタンドアロン HTML(ヘッダ・スタイル込み)に変換する。 */
export function convertToStandaloneHtml(source: string): string {
  return asciidoctor.convert(source, {
    safe: "safe",
    standalone: true,
    attributes: BASE_ATTRIBUTES,
  }) as string;
}
