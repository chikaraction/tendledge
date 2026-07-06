// スタンドアロン HTML エクスポート用の後処理。
// convertToStandaloneHtml() は Asciidoctor.js の素の出力(アドモニションはテキスト
// ラベルのみ)なので、アプリのプレビューと同じ Lucide アイコン付きの見た目に揃える。
// エクスポート先はライトモード固定(@media print のライト配色上書きと同じ考え方)。
import { convertToStandaloneHtml } from "../render";
import { decorateAdmonitionIcons } from "./admonition-icons";

// styles.css の .adoc 配下のアドモニション CSS(ライトモードの値)を、
// クラスプレフィックスなしで複製したもの。エクスポート先は独立した HTML なので
// アプリの styles.css 全体は持ち込まず、装飾に必要な分だけを埋め込む。
const ADMONITION_CSS = `
.admonitionblock {
  display: flex;
  gap: 0.8rem;
  border: 1px solid #e1e1e8;
  border-left: 3px solid #2f80ed;
  border-radius: 0 8px 8px 0;
  padding: 0.7rem 1rem;
  margin: 1em 0;
  background: #f4f4f7;
}
.admonitionblock table, .admonitionblock td { border: none; padding: 0; }
.admonitionblock .icon { padding-right: 1.3rem; margin-right: 0.4rem; border-right: 1px solid #6f6f7e; }
.admonitionblock .icon .title { display: flex; align-items: center; }
.admonitionblock .content { padding-left: 0.9rem; }
.admonition-icon {
  width: 1.3em;
  height: 1.3em;
  padding: 0.3em;
  box-sizing: content-box;
  border-radius: 50%;
  color: #fff;
  background: #2f80ed;
}
.admonitionblock.tip { border-left-color: #d9a005; }
.admonitionblock.tip .admonition-icon { background: #d9a005; }
.admonitionblock.important { border-left-color: #e0393e; }
.admonitionblock.important .admonition-icon { background: #e0393e; }
.admonitionblock.warning { border-left-color: #e08a1e; }
.admonitionblock.warning .admonition-icon { background: #e08a1e; }
.admonitionblock.caution { border-left-color: #d8481e; }
.admonitionblock.caution .admonition-icon { background: #d8481e; }
`;

/** アドモニションを Lucide アイコン付きに装飾したスタンドアロン HTML を作る */
export function buildExportHtml(source: string): string {
  const html = convertToStandaloneHtml(source);
  const doc = new DOMParser().parseFromString(html, "text/html");

  decorateAdmonitionIcons(doc);

  const style = doc.createElement("style");
  style.textContent = ADMONITION_CSS;
  doc.head.appendChild(style);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
