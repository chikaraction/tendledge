import { clampSidebarWidth, sidebarWidthForPointer } from "../core/sidebar-width";

// サイドバーのリサイズ(サイドバー分割線のドラッグ)。
// --sidebar-width CSS 変数を書き換え、styles.css 側がレイアウトに反映する。
// クランプ判断は core/sidebar-width.ts に寄せてあるので、ここは DOM 配線のみ。
export function setupSidebarDivider(workspace: HTMLElement, divider: HTMLElement): void {
  // ウィンドウを縮めたとき、保持中の幅をドラッグで到達できる範囲へ再クランプする。
  // 上限超えのまま残すと、サイドバーがウィンドウの大半を占めたり、
  // 次のドラッグ開始時に一瞬で上限まで飛んだりする。
  new ResizeObserver((entries) => {
    // 一度もドラッグしていなければインライン値が無く、既定値(220px)は常に範囲内
    const current = parseFloat(workspace.style.getPropertyValue("--sidebar-width"));
    if (Number.isNaN(current)) return;
    const clamped = clampSidebarWidth(current, entries[0].contentRect.width);
    if (clamped !== current) {
      workspace.style.setProperty("--sidebar-width", `${clamped}px`);
    }
  }).observe(workspace);

  divider.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    divider.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const rect = workspace.getBoundingClientRect();
      const width = sidebarWidthForPointer(ev.clientX, rect.left, rect.width);
      workspace.style.setProperty("--sidebar-width", `${width}px`);
    };
    const onUp = () => {
      divider.removeEventListener("pointermove", onMove);
      divider.removeEventListener("pointerup", onUp);
    };
    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onUp);
  });
}
