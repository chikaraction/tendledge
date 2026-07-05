// ペインのリサイズ(ディバイダのドラッグ)。
// --editor-ratio CSS 変数を書き換え、styles.css 側がレイアウトに反映する。
export function setupDivider(workspace: HTMLElement, divider: HTMLElement): void {
  divider.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    divider.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const rect = workspace.getBoundingClientRect();
      const ratio = Math.min(0.8, Math.max(0.2, (ev.clientX - rect.left) / rect.width));
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
