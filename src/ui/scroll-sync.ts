// エディタ ⇔ プレビューの双方向スクロール同期の配線
import type { EditorView } from "codemirror";
import { editorScrollToLine, editorTopLine } from "./editor";
import type { PreviewController } from "./preview";

export function setupScrollSync(view: EditorView, preview: PreviewController): void {
  let syncingScroll = false;

  // 2つのスクロールリスナーが互いを再帰的に呼び合わないためのガード。
  function withScrollGuard(fn: () => void): void {
    if (syncingScroll) return;
    syncingScroll = true;
    fn();
    const release = () => {
      syncingScroll = false;
    };
    // requestAnimationFrame が主経路。非表示タブ等で rAF が発火しない場合に
    // ガードが解除されず同期が止まったままにならないよう setTimeout で保険をかける。
    requestAnimationFrame(release);
    setTimeout(release, 100);
  }

  view.scrollDOM.addEventListener("scroll", () => {
    withScrollGuard(() => {
      const target = preview.scrollTopForLine(editorTopLine(view), view.state.doc.lines);
      preview.paneEl.scrollTop = target;
    });
  });

  preview.paneEl.addEventListener("scroll", () => {
    withScrollGuard(() => {
      const lineno = preview.lineForScrollTop(preview.paneEl.scrollTop, view.state.doc.lines);
      editorScrollToLine(view, lineno);
    });
  });
}
