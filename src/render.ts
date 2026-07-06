// Asciidoctor.js による変換(プロセッサは1回だけ生成する)
import Asciidoctor from "@asciidoctor/core";
import DOMPurify from "dompurify";

const asciidoctor = Asciidoctor();

const BASE_ATTRIBUTES = {
  showtitle: true, // 文書タイトル(= 見出し)をプレビューに表示
  sectnums: false,
  // 例示ブロック・表のキャプション接頭辞("Example"/"Table" が英語で付く)を
  // 日本語に差し替える(例: "例 1. タイトル" / "表 1. タイトル")
  "example-caption": "例",
  "table-caption": "表",
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
 *
 * stylesheet: false — @asciidoctor/core のブラウザビルドは既定でデフォルト CSS を
 * 同期 XHR(Opal ランタイムのポリフィル)で読み込もうとするが、Vite の dev/preview
 * サーバーは存在しないパスへの GET を index.html にフォールバックさせるため、
 * その HTML がまるごと <style> に誤って埋め込まれてしまう。この同期読み込み自体を止める
 * (どのみち ui/html-export.ts が .adoc スコープの CSS を別途埋め込むので不要)。
 */
export function convertToStandaloneHtml(source: string): string {
  return asciidoctor.convert(source, {
    safe: "safe",
    standalone: true,
    attributes: { ...BASE_ATTRIBUTES, stylesheet: false },
  }) as string;
}
