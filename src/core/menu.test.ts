import { describe, expect, it } from "vitest";
import { createMenubarState } from "./menu";

describe("createMenubarState: メニューバーの開閉状態", () => {
  it("初期状態ではどのメニューも開いていない", () => {
    const state = createMenubarState();
    expect(state.openMenuId()).toBeUndefined();
  });

  describe("toggle: クリックによる開閉", () => {
    it("閉じているメニューをクリックすると開く", () => {
      const state = createMenubarState();
      state.toggle("file");
      expect(state.openMenuId()).toBe("file");
    });

    it("開いているメニューを再クリックすると閉じる", () => {
      const state = createMenubarState();
      state.toggle("file");
      state.toggle("file");
      expect(state.openMenuId()).toBeUndefined();
    });

    it("別のメニューをクリックするとそちらに切り替わる", () => {
      const state = createMenubarState();
      state.toggle("file");
      state.toggle("view");
      expect(state.openMenuId()).toBe("view");
    });
  });

  describe("hoverTo: ホバーによる切り替え(Windows のメニューバー標準挙動)", () => {
    it("どこかが開いているときは、ホバーしただけで切り替わる", () => {
      const state = createMenubarState();
      state.toggle("file");
      state.hoverTo("view");
      expect(state.openMenuId()).toBe("view");
    });

    it("すべて閉じているときは、ホバーしても開かない", () => {
      const state = createMenubarState();
      state.hoverTo("view");
      expect(state.openMenuId()).toBeUndefined();
    });
  });

  describe("close: Esc・外側クリック・項目選択後", () => {
    it("開いているメニューを閉じる", () => {
      const state = createMenubarState();
      state.toggle("file");
      state.close();
      expect(state.openMenuId()).toBeUndefined();
    });

    it("閉じているときに呼んでも何も起きない", () => {
      const state = createMenubarState();
      expect(() => state.close()).not.toThrow();
      expect(state.openMenuId()).toBeUndefined();
    });
  });
});
