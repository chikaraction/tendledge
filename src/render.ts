// Asciidoctor.js による変換(プロセッサは1回だけ生成する)
import Asciidoctor from "@asciidoctor/core";
import DOMPurify from "dompurify";

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

/**
 * プレビューに流し込む前のサニタイズ。
 * AsciiDoc のパススルーブロック(++++)は safe: "safe" でも生 HTML を素通しするため、
 * 保管庫で開いた第三者のファイルに script 等が仕込まれていても実行されないようにする。
 * この WebView は Tauri API ブリッジ(ファイル書き込み等)を持つので、ここが防壁になる。
 */
export function sanitizePreviewHtml(html: string): string {
  return DOMPurify.sanitize(html);
}

/**
 * エクスポート用のスタンドアロン HTML(ヘッダ・スタイル込み)に変換する。
 * こちらは意図的にサニタイズしない: 自分の文書のパススルーを壊さないため。
 * 出力先はプレーンな HTML ファイルで、Tauri API には触れない。
 */
export function convertToStandaloneHtml(source: string): string {
  return asciidoctor.convert(source, {
    safe: "safe",
    standalone: true,
    attributes: BASE_ATTRIBUTES,
  }) as string;
}
