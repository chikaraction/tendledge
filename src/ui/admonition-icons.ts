// アドモニション(NOTE/TIP/IMPORTANT/WARNING/CAUTION)のラベルに種類別の Lucide アイコンを
// 付ける処理。ライブプレビュー(preview.ts)とスタンドアロン HTML エクスポート(html-export.ts)の
// 両方から使う共通ロジック。Asciidoctor.js のデフォルト出力は td.icon > .title に
// "Note" 等のテキストを置くだけなので、その前に差し込む。
import { icon, icons } from "./icons";

const ADMONITION_ICONS = {
  note: icons.note,
  tip: icons.tip,
  important: icons.important,
  warning: icons.warning,
  caution: icons.caution,
} as const;

/**
 * root 配下の .admonitionblock を装飾する。root は生きたプレビュー DOM でも、
 * DOMParser で作った別ドキュメントでも構わない
 * (SVG は文字列にシリアライズしてから挿入するため、ドキュメントをまたいでも安全)。
 */
export function decorateAdmonitionIcons(root: ParentNode): void {
  const blocks = root.querySelectorAll<HTMLElement>(".admonitionblock");
  blocks.forEach((block) => {
    const type = (Object.keys(ADMONITION_ICONS) as (keyof typeof ADMONITION_ICONS)[]).find(
      (t) => block.classList.contains(t),
    );
    const title = block.querySelector<HTMLElement>("td.icon .title");
    if (!type || !title) return;
    const svg = icon(ADMONITION_ICONS[type], 16, "admonition-icon");
    svg.setAttribute("title", title.textContent ?? "");
    title.replaceChildren();
    title.insertAdjacentHTML("beforeend", new XMLSerializer().serializeToString(svg));
  });
}
