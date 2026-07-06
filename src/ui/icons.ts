// Lucide アイコンの薄いラッパー。
// 採用理由(Obsidian と同じセット・ISC ライセンス)は docs/design-direction.md 参照。
// アイコンを増やすときはここの icons に追記する(直接 lucide を import しない)。
import {
  ChevronRight,
  CircleAlert,
  Columns2,
  createElement,
  Eye,
  FileText,
  Flame,
  Folder,
  type IconNode,
  Info,
  Lightbulb,
  Pencil,
  RotateCw,
  TriangleAlert,
  X,
} from "lucide";

export const icons = {
  chevron: ChevronRight,
  file: FileText,
  folder: Folder,
  refresh: RotateCw,
  close: X,
  // アドモニション(NOTE/TIP/IMPORTANT/WARNING/CAUTION)用
  note: Info,
  tip: Lightbulb,
  important: CircleAlert,
  warning: TriangleAlert,
  caution: Flame,
  // 表示モード切り替え用
  splitView: Columns2,
  previewOnly: Eye,
  edit: Pencil,
} satisfies Record<string, IconNode>;

/** サイズとクラスを付けた SVG 要素を作る。色は currentColor を継承する。 */
export function icon(node: IconNode, size = 14, className?: string): SVGElement {
  const el = createElement(node);
  el.setAttribute("width", String(size));
  el.setAttribute("height", String(size));
  el.setAttribute("aria-hidden", "true");
  if (className) el.classList.add(...className.split(" "));
  return el;
}
