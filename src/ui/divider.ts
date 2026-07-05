// ペインのリサイズ(ディバイダのドラッグ)。
// --editor-ratio CSS 変数を書き換え、styles.css 側がレイアウトに反映する。
export function setupDivider(workspace: HTMLElement, divider: HTMLElement): void {
  divider.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    divider.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const rect = workspace.getBoundingClientRect();
      // --editor-ratio は workspace 全体の幅に対する割合として CSS 側で使われるが、
      // エディタペインはサイドバー分だけ右にずれた位置から始まる。分母を workspace
      // 全体の幅のままにしないと、サイドバー表示中にドラッグ中のカーソルと区切り線の
      // 位置が食い違う。
      const sidebar = workspace.querySelector<HTMLElement>("#sidebar");
      const sidebarWidth = sidebar && !sidebar.hidden ? sidebar.getBoundingClientRect().width : 0;
      const contentLeft = rect.left + sidebarWidth;
      const ratio = Math.min(0.8, Math.max(0.2, (ev.clientX - contentLeft) / rect.width));
      workspace.style.setProperty("--editor-ratio", `${ratio * 100}%`);
    };
    const onUp = () => {
      divider.removeEventListener("pointermove", onMove);
      divider.removeEventListener("pointerup", onUp);
    };
    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onUp);
  });
}
