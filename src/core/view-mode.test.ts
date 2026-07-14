import { describe, expect, it } from "vitest";
import {
  advanceChord,
  createViewModeState,
  enterHelpMode,
  leaveHelpMode,
  setMode,
  togglePreview,
  toggleSplit,
} from "./view-mode";

describe("createViewModeState: 表示モードの初期状態", () => {
  it("初期状態は split で、lastEditMode も split", () => {
    const state = createViewModeState();
    expect(state.mode).toBe("split");
    expect(state.lastEditMode).toBe("split");
  });
});

describe("toggleSplit: 「横にプレビューを開く」(Ctrl+K V 相当)", () => {
  it("editor から split へ切り替わる", () => {
    const state = { mode: "editor", lastEditMode: "editor" } as const;
    const next = toggleSplit(state);
    expect(next.mode).toBe("split");
    expect(next.lastEditMode).toBe("split");
  });

  it("split から editor へ切り替わる(トグル)", () => {
    const state = { mode: "split", lastEditMode: "split" } as const;
    const next = toggleSplit(state);
    expect(next.mode).toBe("editor");
    expect(next.lastEditMode).toBe("editor");
  });

  it("preview から split へ切り替わる", () => {
    const state = { mode: "preview", lastEditMode: "editor" } as const;
    const next = toggleSplit(state);
    expect(next.mode).toBe("split");
    expect(next.lastEditMode).toBe("split");
  });
});

describe("togglePreview: 「プレビューとして開く」(Ctrl+Shift+V 相当)", () => {
  it("editor から preview へ切り替わり、戻り先として editor を覚える", () => {
    const state = { mode: "editor", lastEditMode: "editor" } as const;
    const next = togglePreview(state);
    expect(next.mode).toBe("preview");
    expect(next.lastEditMode).toBe("editor");
  });

  it("split から preview へ切り替わり、戻り先として split を覚える", () => {
    const state = { mode: "split", lastEditMode: "split" } as const;
    const next = togglePreview(state);
    expect(next.mode).toBe("preview");
    expect(next.lastEditMode).toBe("split");
  });

  it("preview から、入る直前が editor だったら editor に戻る", () => {
    const state = { mode: "preview", lastEditMode: "editor" } as const;
    const next = togglePreview(state);
    expect(next.mode).toBe("editor");
    expect(next.lastEditMode).toBe("editor");
  });

  it("preview から、入る直前が split だったら split に戻る", () => {
    const state = { mode: "preview", lastEditMode: "split" } as const;
    const next = togglePreview(state);
    expect(next.mode).toBe("split");
    expect(next.lastEditMode).toBe("split");
  });
});

describe("setMode: メニューからの直接指定", () => {
  it("editor を指定すると mode と lastEditMode が editor になる", () => {
    const state = { mode: "preview", lastEditMode: "split" } as const;
    const next = setMode(state, "editor");
    expect(next.mode).toBe("editor");
    expect(next.lastEditMode).toBe("editor");
  });

  it("split を指定すると mode と lastEditMode が split になる", () => {
    const state = { mode: "editor", lastEditMode: "editor" } as const;
    const next = setMode(state, "split");
    expect(next.mode).toBe("split");
    expect(next.lastEditMode).toBe("split");
  });

  it("preview を指定すると mode だけ変わり、lastEditMode は直前のまま保持される", () => {
    const state = { mode: "split", lastEditMode: "split" } as const;
    const next = setMode(state, "preview");
    expect(next.mode).toBe("preview");
    expect(next.lastEditMode).toBe("split");
  });
});

describe("enterHelpMode / leaveHelpMode: ヘルプタブのプレビュー固定と復元", () => {
  it("split から入ると preview になり、復元先として split を覚える", () => {
    const state = { mode: "split", lastEditMode: "split" } as const;
    const entered = enterHelpMode(state);
    expect(entered.state.mode).toBe("preview");
    expect(entered.restoreTo).toBe("split");
  });

  it("editor から入ると preview になり、復元先として editor を覚える", () => {
    const state = { mode: "editor", lastEditMode: "editor" } as const;
    const entered = enterHelpMode(state);
    expect(entered.state.mode).toBe("preview");
    expect(entered.restoreTo).toBe("editor");
  });

  it("すでに preview なら状態は変わらず、復元先もない", () => {
    const state = { mode: "preview", lastEditMode: "split" } as const;
    const entered = enterHelpMode(state);
    expect(entered.state).toEqual(state);
    expect(entered.restoreTo).toBeUndefined();
  });

  it("離れるとき、復元先があれば preview からそのモードへ戻る", () => {
    const state = { mode: "preview", lastEditMode: "split" } as const;
    const next = leaveHelpMode(state, "split");
    expect(next.mode).toBe("split");
    expect(next.lastEditMode).toBe("split");
  });

  it("復元先がなければ(preview 中に開いた)preview のまま", () => {
    const state = { mode: "preview", lastEditMode: "editor" } as const;
    const next = leaveHelpMode(state, undefined);
    expect(next).toEqual(state);
  });

  it("ヘルプ表示中に手動でモードを変えていたら、復元で上書きしない", () => {
    // ユーザーが Ctrl+K V 等で split に切り替えた後に別タブへ移った場合
    const state = { mode: "split", lastEditMode: "split" } as const;
    const next = leaveHelpMode(state, "editor");
    expect(next).toEqual(state);
  });
});

describe("advanceChord: Ctrl+K V のコード入力判定", () => {
  it("待機中でないときに 'k' を受けると、pending になる", () => {
    const result = advanceChord(undefined, "k");
    expect(result).toBe("pending");
  });

  it("待機中でないときに 'k' 以外を受けると、何も起きない(idle)", () => {
    const result = advanceChord(undefined, "v");
    expect(result).toBe("idle");
  });

  it("pending 中に 'v' を受けると、発火する(fire)", () => {
    const result = advanceChord("pending", "v");
    expect(result).toBe("fire");
  });

  it("pending 中に 'v' 以外を受けると、解除される(idle)", () => {
    const result = advanceChord("pending", "x");
    expect(result).toBe("idle");
  });

  it("pending 中に 'k' を再度受けると、pending を維持する", () => {
    const result = advanceChord("pending", "k");
    expect(result).toBe("pending");
  });
});
