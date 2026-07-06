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

const EXPORT_CSS = extractLightAdocCss(stylesCssRaw);

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
