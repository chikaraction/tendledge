// Asciidoctor.js による変換
import { convert, Extensions, load } from "@asciidoctor/core";
import type { BlockProcessorDslInterface, Document, Registry } from "@asciidoctor/core";
import DOMPurify from "dompurify";
import { renderBylineHtml, type BylineInfo } from "./core/byline";

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
  Extensions.register(function (this: Registry) {
    this.block(function (this: BlockProcessorDslInterface) {
      this.named(name);
      this.onContexts("listing", "literal");
      this.parseContentAs("raw");
      this.process(function (parent, reader, attrs) {
        const block = this.createBlock(parent, "listing", reader.getLines().join("\n"), {
          style: "source",
          language,
        });
        // createBlock はタイトル(`.タイトル` 記法)を引き継がないため、
        // 元のブロックの attrs から明示的に移す(引き継がないと
        // ブロック丸ごとの差し替え時にタイトルが消える)
        const title = attrs.title as string | undefined;
        if (title) block.setTitle(title);
        return block;
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
  // 日本語に差し替える(例: "例 1. タイトル" / "表 1. タイトル")。
  // 末尾の @ はソフト設定の印: API 経由の属性は既定で文書側から変更できなく
  // なる(ロックされる)ため、@ を付けて文書内の :example-caption: 等による
  // 上書きを許す(あくまで既定値の差し替えであり、強制はしない)。
  "example-caption": "例@",
  "table-caption": "表@",
  // :toc: を書いた文書の目次見出し("Table of Contents" が英語で付く)も日本語化
  "toc-title": "目次@",
};

/**
 * 文書の著者・リビジョン属性からバイライン情報を取り出す。
 * doc.getAuthors() / getRevisionNumber() 等はいずれも情報が無ければ
 * undefined を返すので、core/byline.ts の BylineInfo 形式に詰め替えるだけ。
 */
function extractBylineInfo(doc: Document): BylineInfo {
  const authors = doc
    .getAuthors()
    .map((author) => ({ name: author.getName() ?? "", email: author.getEmail() }))
    .filter((author) => author.name !== "");

  const revision = {
    number: doc.getRevisionNumber(),
    date: doc.getRevisionDate(),
    remark: doc.getRevisionRemark(),
  };
  const hasRevision = Boolean(revision.number || revision.date || revision.remark);

  return { authors, revision: hasRevision ? revision : undefined };
}

/**
 * プレビュー用の HTML 断片に変換する。
 * convert() 相当を load() + doc.convert() の2段階にしているのは、
 * 変換後の Document から doc.getAuthors() / getRevisionNumber() 等を読み、
 * バイラインを組み立てるため(オプションは convert() 直呼びと同一 = BASE_ATTRIBUTES のみ)。
 * バイラインは showtitle 由来の先頭 <h1> の直後に挿入する。情報が空、または
 * 文書にタイトルが無く <h1> が出力されていない場合は何も挿入しない
 * (スクロール同期は h1〜h6 の見出しペアリングに依存するため、バイライン自体は
 * 見出しタグを使わない)。
 */
export async function convertToPreviewHtml(source: string): Promise<string> {
  const doc = await load(source, {
    safe: "safe",
    attributes: BASE_ATTRIBUTES,
  });
  const html = await doc.convert();

  const byline = renderBylineHtml(extractBylineInfo(doc));
  if (!byline) return html;

  const h1Close = "</h1>";
  if (!html.startsWith("<h1")) return html;
  const insertAt = html.indexOf(h1Close);
  if (insertAt === -1) return html;

  const afterH1 = insertAt + h1Close.length;
  return `${html.slice(0, afterH1)}\n${byline}${html.slice(afterH1)}`;
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
 * stylesheet: false — 指定しないと Asciidoctor.js の既定 CSS が <style> として
 * 埋め込まれる。ui/html-export.ts が .adoc スコープの CSS を別途埋め込むので、
 * 既定 CSS は不要かつ二重管理を避けるためここで明示的に無効化する。
 */
export async function convertToStandaloneHtml(source: string): Promise<string> {
  return (await convert(source, {
    safe: "safe",
    standalone: true,
    attributes: { ...BASE_ATTRIBUTES, stylesheet: false },
  })) as string;
}
