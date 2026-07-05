// スクロール同期の補間計算(純粋関数)
//
// ソースの見出し行とプレビューの見出し要素を出現順で対応付けた「アンカー」を前提に、
// アンカー間を線形補間して両者のスクロール位置を相互変換する。
// DOM の測定(要素のオフセット、maxScroll)は呼び出し側(ui 層)が行い、
// ここは数値だけを扱う。

export interface AnchorPoint {
  /** ソース上の見出し行番号(1 始まり) */
  lineno: number;
  /** プレビューペイン内での見出し要素のスクロールオフセット(px) */
  offset: number;
}

/** エディタの行番号 → プレビューの scrollTop */
export function previewScrollTopForLine(
  lineno: number,
  totalLines: number,
  anchors: readonly AnchorPoint[],
  maxScroll: number,
): number {
  if (anchors.length === 0) {
    return totalLines <= 1 ? 0 : (maxScroll * (lineno - 1)) / (totalLines - 1);
  }
  const first = anchors[0];
  if (lineno <= first.lineno) {
    const frac = first.lineno <= 1 ? 0 : lineno / first.lineno;
    return first.offset * frac;
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (lineno >= a.lineno && lineno <= b.lineno) {
      const frac = (lineno - a.lineno) / (b.lineno - a.lineno || 1);
      return a.offset + frac * (b.offset - a.offset);
    }
  }
  const last = anchors[anchors.length - 1];
  const remainingFrac =
    totalLines <= last.lineno ? 0 : (lineno - last.lineno) / (totalLines - last.lineno);
  return last.offset + remainingFrac * (maxScroll - last.offset);
}

/** プレビューの scrollTop → エディタの行番号 */
export function editorLineForPreviewScrollTop(
  scrollTop: number,
  totalLines: number,
  anchors: readonly AnchorPoint[],
  maxScroll: number,
): number {
  if (anchors.length === 0) {
    if (maxScroll <= 0) return 1;
    return Math.round(1 + (scrollTop / maxScroll) * (totalLines - 1));
  }
  const first = anchors[0];
  if (scrollTop <= first.offset) {
    const frac = first.offset <= 0 ? 0 : scrollTop / first.offset;
    return Math.round(frac * first.lineno);
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (scrollTop >= a.offset && scrollTop <= b.offset) {
      const frac = (scrollTop - a.offset) / (b.offset - a.offset || 1);
      return Math.round(a.lineno + frac * (b.lineno - a.lineno));
    }
  }
  const last = anchors[anchors.length - 1];
  const remainingFrac =
    maxScroll <= last.offset ? 0 : (scrollTop - last.offset) / (maxScroll - last.offset);
  return Math.round(last.lineno + remainingFrac * (totalLines - last.lineno));
}
