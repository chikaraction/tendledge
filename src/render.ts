// Asciidoctor.js による変換(プロセッサは1回だけ生成する)
import Asciidoctor from "@asciidoctor/core";
import DOMPurify from "dompurify";

const asciidoctor = Asciidoctor();

// [mermaid] ブロックを [source,mermaid] と同一の出力に正規化する拡張。
// 素の Asciidoctor では [mermaid] スタイルは HTML に痕跡を残さない
// (ただの listingblock になり class も data 属性も付かない)ことを実測で確認済み。
// 正規化により後段(プレビューの図レンダリング・エクスポート焼き込み)は
// code[data-lang="mermaid"] の1経路だけを見ればよくなる。
// グローバル登録なのは、Extensions.create() の registry を convert に渡す方式だと
// 最初の1回しか拡張が効かない(2回目から黙って素通しになる)ことを実測したため。
// [plantuml] / [drawio] も同じ理由(素の Asciidoctor ではスタイルが HTML に
// 残らない)で source,<lang> に正規化する。[diagramsnet] は Kroki 側の
// 図種別名なので、Asciidoctor Diagram の慣習である [drawio] のエイリアスとして受ける。
function registerNormalizeBlock(name: string, language: string): void {
  asciidoctor.Extensions.register(function () {
    this.block(function () {
      this.named(name);
      this.onContexts("listing", "literal");
      this.parseContentAs("raw");
      this.process(function (parent, reader) {
        return this.createBlock(parent, "listing", reader.getLines().join("\n"), {
          style: "source",
          language,
        });
      });
    });
  });
}

registerNormalizeBlock("mermaid", "mermaid");
registerNormalizeBlock("plantuml", "plantuml");
registerNormalizeBlock("drawio", "drawio");
registerNormalizeBlock("diagramsnet", "drawio");

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
 * mermaid が生成した SVG を挿入前にサニタイズする(多層防御)。
 * 入力はサニタイズ済み DOM の textContent 起点なので理論上は安全だが、
 * mermaid 側の脆弱性への保険として SVG プロファイルで通す。
 * mermaid の配色は SVG 内の <style> に載っており、SVG プロファイルは
 * <style> を残し foreignObject / script / イベント属性を落とすことを
 * テストで固定している(htmlLabels を無効化して foreignObject に依存しない)。
 */
export function sanitizeMermaidSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
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
