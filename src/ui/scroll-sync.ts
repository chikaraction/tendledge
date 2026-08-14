// エディタ ⇔ プレビューの双方向スクロール同期の配線
import type { EditorView } from "codemirror";
import { editorScrollToLine, editorTopLine } from "./editor";
import type { PreviewController } from "./preview";

export interface ScrollSyncController {
  /**
   * 同期を一時停止し、再開関数を返す。タブ切替の間はこれで停止しておく。
   * 切替中は setState でエディタの内容が変わる一方、プレビューはまだ古いタブの
   * アンカーのまま(re-render が非同期で後から追いつく)なので、その間に
   * スクロールイベントが飛ぶと片方の内容量でもう片方を誤った位置へ動かしてしまう。
   *
   * カウント方式: suspend() を呼ぶたびに内部カウンタが +1 され、返す resume 関数は
   * それぞれ自分の呼び出し分だけ -1 する。素早い連続タブ切替(A→B→C)で
   * B の resume が C の切替中に呼ばれても、カウンタが 0 に戻るまで同期は
   * 再開しない(古い呼び出しが新しい suspend を誤って解除しない)。
   */
  suspend(): () => void;
}

export function setupScrollSync(
  view: EditorView,
  preview: PreviewController,
  opts: {
    /**
     * ペインが表示されているかの判定。既定は offsetParent(display: none の
     * 祖先を持つと null)。jsdom はレイアウトを持たず常に null になるため、
     * テストから差し替えられるようにしている。
     */
    isVisible?: (el: HTMLElement) => boolean;
  } = {},
): ScrollSyncController {
  const isVisible = opts.isVisible ?? ((el: HTMLElement) => el.offsetParent !== null);
  let syncingScroll = false;
  let suspendCount = 0;

  // 2つのスクロールリスナーが互いを再帰的に呼び合わないためのガード。
  function withScrollGuard(fn: () => void): void {
    if (syncingScroll || suspendCount > 0) return;
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

  // 表示モードで非表示になったペイン(display: none)は scrollTop が 0 に固定される。
  // その 0 を相手へ同期すると相手が必ず先頭へ飛ぶため、見えていない側を起点にした
  // 同期は行わない。常にプレビューのみ表示になるヘルプタブで、タブ復帰後に
  // CodeMirror の measure(rAF)が発火させる scroll イベントがこの経路を通り、
  // 復元済みのプレビュー位置を 0 で上書きしていた。
  view.scrollDOM.addEventListener("scroll", () => {
    if (!isVisible(view.scrollDOM)) return;
    withScrollGuard(() => {
      const target = preview.scrollTopForLine(editorTopLine(view), view.state.doc.lines);
      preview.paneEl.scrollTop = target;
    });
  });

  preview.paneEl.addEventListener("scroll", () => {
    if (!isVisible(preview.paneEl)) return; // エディタのみ表示のとき(対称の保険)
    withScrollGuard(() => {
      const lineno = preview.lineForScrollTop(preview.paneEl.scrollTop, view.state.doc.lines);
      editorScrollToLine(view, lineno);
    });
  });

  return {
    suspend() {
      suspendCount += 1;
      let resumed = false;
      return () => {
        if (resumed) return; // 同じ resume を二重に呼んでもカウンタを壊さない
        resumed = true;
        suspendCount -= 1;
      };
    },
  };
}
