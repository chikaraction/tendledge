import { sidebarWidthForPointer } from "../core/sidebar-width";

// サイドバーのリサイズ(サイドバー分割線のドラッグ)。
// --sidebar-width CSS 変数を書き換え、styles.css 側がレイアウトに反映する。
// クランプ判断は core/sidebar-width.ts に寄せてあるので、ここは DOM 配線のみ。
export function setupSidebarDivider(workspace: HTMLElement, divider: HTMLElement): void {
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
