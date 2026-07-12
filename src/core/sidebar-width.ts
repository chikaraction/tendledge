// サイドバー分割線ドラッグの幅クランプ(純粋ロジック)。
// ui/sidebar-divider.ts から呼ばれ、ポインタ位置を --sidebar-width に
// 反映する前にここでクランプする。

export const MIN_SIDEBAR_WIDTH = 150;
export const MAX_SIDEBAR_WIDTH = 500;
/** 最大化などの広いウィンドウでは 500px 固定より広げたいので、幅の40%との大きい方を上限にする */
export const MAX_SIDEBAR_RATIO = 0.4;
/** エディタ+プレビュー側に最低限残すコンテンツ幅 */
export const MIN_CONTENT_WIDTH = 200;

/** ポインタの clientX からクランプ済みのサイドバー幅(px)を返す */
export function sidebarWidthForPointer(
  pointerX: number,
  workspaceLeft: number,
  workspaceWidth: number,
): number {
  const raw = pointerX - workspaceLeft;
  // 上限は「500px とウィンドウ幅の40%の大きい方」。ただしウィンドウが狭いときは
  // エディタ/プレビュー側を潰さないよう、コンテンツ領域の最低幅を差し引いた値を優先する
  const wideMax = Math.max(MAX_SIDEBAR_WIDTH, workspaceWidth * MAX_SIDEBAR_RATIO);
  const dynamicMax = Math.min(wideMax, workspaceWidth - MIN_CONTENT_WIDTH);
  // 動的上限が MIN_SIDEBAR_WIDTH を下回るほど極端に狭い場合でも、
  // 負値や 0 を返さないよう MIN_SIDEBAR_WIDTH を優先する
  const upperBound = Math.max(dynamicMax, MIN_SIDEBAR_WIDTH);
  return Math.min(upperBound, Math.max(MIN_SIDEBAR_WIDTH, raw));
}
