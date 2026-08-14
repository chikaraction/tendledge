// @vitest-environment jsdom
// 「見えていない側からは同期しない」規則の回帰テスト。
//
// 表示モードで非表示になったペイン(display: none)は scrollTop が 0 に固定される。
// その 0 を相手へ同期すると、相手が必ず先頭へ飛ばされる。実際、常にプレビューのみ
// 表示になるヘルプタブで「戻ると必ず一番上」という症状として発生した
// (エディタが非表示 → editorTopLine() が常に 1 行目 → プレビュー先頭)。
//
// jsdom はレイアウトを持たず offsetParent が常に null になるため、可視判定は
// 差し替え可能にしてある。ここではその差し替えを使って両方向を固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "codemirror";
import type { PreviewController } from "./preview";

vi.mock("./editor", () => ({
  editorTopLine: vi.fn(() => 42),
  editorScrollToLine: vi.fn(),
}));

import { editorScrollToLine } from "./editor";
import { setupScrollSync } from "./scroll-sync";

function setup(visible: { editor: boolean; preview: boolean }) {
  document.body.innerHTML = `<div id="ed"></div><div id="pv"></div>`;
  const scrollDOM = document.getElementById("ed") as HTMLElement;
  const paneEl = document.getElementById("pv") as HTMLElement;
  const view = {
    scrollDOM,
    state: { doc: { lines: 100 } },
  } as unknown as EditorView;
  const preview = {
    paneEl,
    scrollTopForLine: vi.fn(() => 0), // 非表示エディタが返す「1行目 → 先頭」に相当
    lineForScrollTop: vi.fn(() => 1),
  } as unknown as PreviewController;
  setupScrollSync(view, preview, {
    isVisible: (el) => (el === scrollDOM ? visible.editor : visible.preview),
  });
  return { scrollDOM, paneEl, preview };
}

describe("setupScrollSync: 非表示ペインからの同期を行わない", () => {
  beforeEach(() => {
    vi.mocked(editorScrollToLine).mockClear();
  });

  it("エディタが非表示のとき、エディタのスクロールはプレビューへ同期しない", () => {
    const { scrollDOM, paneEl, preview } = setup({ editor: false, preview: true });
    paneEl.scrollTop = 2818; // ヘルプタブで復元された位置

    scrollDOM.dispatchEvent(new Event("scroll"));

    expect(preview.scrollTopForLine).not.toHaveBeenCalled();
    expect(paneEl.scrollTop).toBe(2818); // 先頭へ飛ばされない
  });

  it("エディタが表示されているときは従来どおり同期する", () => {
    const { scrollDOM, paneEl, preview } = setup({ editor: true, preview: true });
    paneEl.scrollTop = 2818;

    scrollDOM.dispatchEvent(new Event("scroll"));

    expect(preview.scrollTopForLine).toHaveBeenCalledWith(42, 100);
    expect(paneEl.scrollTop).toBe(0);
  });

  it("プレビューが非表示のとき、プレビューのスクロールはエディタへ同期しない", () => {
    const { paneEl, preview } = setup({ editor: true, preview: false });

    paneEl.dispatchEvent(new Event("scroll"));

    expect(preview.lineForScrollTop).not.toHaveBeenCalled();
    expect(editorScrollToLine).not.toHaveBeenCalled();
  });

  it("プレビューが表示されているときは従来どおり同期する", () => {
    const { paneEl, preview } = setup({ editor: true, preview: true });

    paneEl.dispatchEvent(new Event("scroll"));

    expect(preview.lineForScrollTop).toHaveBeenCalled();
    expect(editorScrollToLine).toHaveBeenCalled();
  });
});
