// スタンドアロン HTML エクスポート用の後処理。
// convertToStandaloneHtml() は Asciidoctor.js の素の出力なので、ライブプレビューと
// 見た目・挙動が揃うように以下を補う:
// - アドモニションアイコン・チェックリストのチェックボックス化(プレビューと同じ DOM 装飾)
// - .adoc スコープの CSS(ライト固定。styles.css から抽出)
// - 著者バイライン(プレビューには出ない要素なので、エクスポートでも消して合わせる)
import stylesCssRaw from "../styles.css?raw";
import { extractLightAdocCss } from "../core/export-css";
import { convertToStandaloneHtml } from "../render";
import { decorateAdmonitionIcons } from "./admonition-icons";
import { decorateChecklists } from "./checklist-decoration";

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
export function buildExportHtml(source: string): string {
  const html = convertToStandaloneHtml(source);
  const doc = new DOMParser().parseFromString(html, "text/html");

  decorateAdmonitionIcons(doc);
  decorateChecklists(doc);

  // ライブプレビューは :author: があってもタイトルのみでバイラインを出さないため、
  // standalone: true が自動生成する著者バイラインを削除して挙動を揃える
  doc.querySelector("#header .details")?.remove();

  doc.body.classList.add("adoc");

  const style = doc.createElement("style");
  style.textContent = EXPORT_CSS;
  doc.head.appendChild(style);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
