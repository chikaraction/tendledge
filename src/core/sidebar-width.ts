// サイドバー分割線ドラッグの幅クランプ(純粋ロジック)。
// ui/sidebar-divider.ts から呼ばれ、ポインタ位置を --sidebar-width に
// 反映する前にここでクランプする。

export const MIN_SIDEBAR_WIDTH = 150;
export const MAX_SIDEBAR_WIDTH = 500;
/** エディタ+プレビュー側に最低限残すコンテンツ幅 */
export const MIN_CONTENT_WIDTH = 200;

/** ポインタの clientX からクランプ済みのサイドバー幅(px)を返す */
export function sidebarWidthForPointer(
  pointerX: number,
  workspaceLeft: number,
  workspaceWidth: number,
): number {
  const raw = pointerX - workspaceLeft;
  // ウィンドウが狭いときはエディタ/プレビュー側を潰さないよう、
  // コンテンツ領域の最低幅を差し引いた値を上限にする(MAX_SIDEBAR_WIDTH との小さい方)
  const dynamicMax = Math.min(MAX_SIDEBAR_WIDTH, workspaceWidth - MIN_CONTENT_WIDTH);
  // 動的上限が MIN_SIDEBAR_WIDTH を下回るほど極端に狭い場合でも、
  // 負値や 0 を返さないよう MIN_SIDEBAR_WIDTH を優先する
  const upperBound = Math.max(dynamicMax, MIN_SIDEBAR_WIDTH);
  return Math.min(upperBound, Math.max(MIN_SIDEBAR_WIDTH, raw));
}
