// スタンドアロン HTML エクスポート用の後処理。
// convertToStandaloneHtml() は Asciidoctor.js の素の出力なので、ライブプレビューと
// 見た目・挙動が揃うように以下を補う:
// - アドモニションアイコン・チェックリストのチェックボックス化(プレビューと同じ DOM 装飾)
// - コードブロックのシンタックスハイライト(スクリプト同梱なしで静的に焼き込む)
// - .adoc スコープの CSS(ライト固定。styles.css から抽出。--hl-* トークンも含む)
//
// 著者バイライン(standalone: true が自動生成する #header .details)は
// 2026-07-14 以降そのまま残す。ライブプレビュー側にも render.ts が同じ
// マークアップ構造でバイラインを挿入するようになったため、WYSIWYG は
// 「エクスポート側で消す」のではなく「プレビュー側に足す」ことで保たれている
// (経緯は docs/export-notes.md 参照)。
import stylesCssRaw from "../styles.css?raw";
import { extractLightAdocCss } from "../core/export-css";
import { convertToStandaloneHtml } from "../render";
import { decorateAdmonitionIcons } from "./admonition-icons";
import { decorateChecklists } from "./checklist-decoration";
import { decorateCodeBlocks } from "./code-highlight";
import { renderKrokiBlocks } from "./kroki";
import { renderMermaidBlocks } from "./mermaid";

// 抽出した .adoc ルールは var(--bg) 等を参照するだけで、ページ全体(html/body)の
// 背景・文字色は自分では確定させない。素の Asciidoctor 出力は body に背景/文字色を
// 指定しないため、抽出した :root の color-scheme: light dark がそのまま生きていると、
// 読み手のブラウザ/OS がダーク優先のときに body の既定色をブラウザが勝手にダークへ
// 倒してしまい、ライト固定で塗った .admonitionblock 等の背景と衝突する
// (背景はライトなのに文字色だけダークの UA 既定色になり、読みにくくなる)。
// ライト固定を保証するため、抽出結果より後ろに明示的な上書きを追加する。
const EXPORT_CSS = `${extractLightAdocCss(stylesCssRaw)}
:root {
  color-scheme: light;
}
body {
  background: var(--bg);
  color: var(--fg);
}`;

/** アドモニションアイコン等を装飾し、プレビューと見た目・構成を揃えたスタンドアロン HTML を作る */
export async function buildExportHtml(
  source: string,
  kroki?: { enabled: boolean; serverUrl: string },
): Promise<string> {
  const html = await convertToStandaloneHtml(source);
  const doc = new DOMParser().parseFromString(html, "text/html");

  decorateAdmonitionIcons(doc);
  decorateChecklists(doc);
  decorateCodeBlocks(doc);

  // mermaid 図を SVG に焼き込む(スクリプト同梱なし・開くだけで表示)。
  // エクスポートはライト固定なので default テーマで描く。焼き込む SVG 自体は
  // renderMermaidBlocks 内で sanitizeMermaidSvg を通る(パススルー等の他要素には触れない)。
  await renderMermaidBlocks(doc, "default");

  // Kroki(PlantUML / Draw.io)はオプトイン設定が有効なときだけ焼き込む
  // (無効ならエクスポートのためだけに文書内容を外部へ送信しない)。
  // 失敗したブロックは renderKrokiBlocks 内でコードブロックのまま残る。
  if (kroki?.enabled) {
    await renderKrokiBlocks(doc, { serverUrl: kroki.serverUrl });
  }

  doc.body.classList.add("adoc");

  const style = doc.createElement("style");
  style.textContent = EXPORT_CSS;
  doc.head.appendChild(style);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
