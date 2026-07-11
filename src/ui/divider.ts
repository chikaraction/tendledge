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
      // styles.css 側は width = (contentWidth - gutterWidth) * ratio + gutterWidth で
      // #editor-pane 幅を決めているため、ドラッグ計算も同じ式を逆算する
      // (ガター幅を除いた本文領域だけで比率を取ることで、50% でプレビューと同幅になる)。
      const gutterWidth = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--editor-gutter-width"),
      );
      // 分母(ガターを除いたコンテンツ幅)が極端に小さい/0以下だと ratio が
      // NaN や Infinity になり --editor-ratio に不正値が入ってレイアウトが壊れる。
      // ウィンドウの最小サイズ(tauri.conf.json)である程度は防げるが、念のため
      // ここでも早期リターンで守る。
      const MIN_CONTENT_WIDTH_FOR_RATIO = 50;
      if (contentWidth - gutterWidth < MIN_CONTENT_WIDTH_FOR_RATIO) return;
      const editorPaneWidth = ev.clientX - contentLeft;
      const ratio = Math.min(
        0.8,
        Math.max(0.2, (editorPaneWidth - gutterWidth) / (contentWidth - gutterWidth)),
      );
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
