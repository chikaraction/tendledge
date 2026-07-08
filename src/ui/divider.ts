// ペインのリサイズ(ディバイダのドラッグ)。
// --editor-ratio CSS 変数を書き換え、styles.css 側がレイアウトに反映する。
export function setupDivider(workspace: HTMLElement, divider: HTMLElement): void {
  divider.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    divider.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const rect = workspace.getBoundingClientRect();
      // --editor-ratio はサイドバーを除いたコンテンツ領域に対する割合(単位なし)。
      // 分母をコンテンツ領域に揃えることで、サイドバーを開閉しても
      // エディタ:プレビューの比率が保たれる(styles.css の --content-width と対応)。
      const sidebar = workspace.querySelector<HTMLElement>("#sidebar");
      const sidebarWidth = sidebar && !sidebar.hidden ? sidebar.getBoundingClientRect().width : 0;
      const contentLeft = rect.left + sidebarWidth;
      const contentWidth = rect.width - sidebarWidth;
      const ratio = Math.min(0.8, Math.max(0.2, (ev.clientX - contentLeft) / contentWidth));
      workspace.style.setProperty("--editor-ratio", `${ratio}`);
    };
    const onUp = () => {
      divider.removeEventListener("pointermove", onMove);
      divider.removeEventListener("pointerup", onUp);
    };
    divider.addEventListener("pointermove", onMove);
    divider.addEventListener("pointerup", onUp);
  });
}
