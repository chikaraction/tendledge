import { describe, expect, it } from "vitest";
import { createDocumentStore } from "./documents";

describe("createDocumentStore: タブ = ドキュメントの状態管理", () => {
  describe("初期状態", () => {
    it("初期内容を持つ Untitled ドキュメントが 1 つだけ存在し、アクティブである", () => {
      const store = createDocumentStore({ initialContent: "= 初期文書" });
      expect(store.list()).toHaveLength(1);
      const active = store.activeDoc();
      expect(active.path).toBeUndefined();
      expect(active.content).toBe("= 初期文書");
    });

    it("初期ドキュメントは dirty ではない(初期内容 = 保存済み扱い)", () => {
      const store = createDocumentStore({ initialContent: "= 初期文書" });
      expect(store.isDirty(store.activeDoc().id)).toBe(false);
    });
  });

  describe("openUntitled: 新規タブ", () => {
    it("空の Untitled タブが末尾に追加され、アクティブになる", () => {
      const store = createDocumentStore({ initialContent: "a" });
      const doc = store.openUntitled();
      expect(store.list()).toHaveLength(2);
      expect(store.list()[1].id).toBe(doc.id);
      expect(store.activeDoc().id).toBe(doc.id);
      expect(doc.content).toBe("");
      expect(doc.path).toBeUndefined();
    });

    it("複数開いてもそれぞれ別の ID を持つ", () => {
      const store = createDocumentStore({ initialContent: "" });
      const a = store.openUntitled();
      const b = store.openUntitled();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("openFile: ファイルを開く", () => {
    it("path 付きのタブが末尾に追加され、アクティブになる", () => {
      const store = createDocumentStore({ initialContent: "" });
      const { doc, alreadyOpen } = store.openFile("C:\\docs\\a.adoc", "本文A");
      expect(alreadyOpen).toBe(false);
      expect(store.activeDoc().id).toBe(doc.id);
      expect(doc.path).toBe("C:\\docs\\a.adoc");
      expect(store.isDirty(doc.id)).toBe(false); // 開いた直後は保存済み扱い
    });

    it("すでに開いている path を開くと、新タブを作らず既存タブをアクティブ化する", () => {
      const store = createDocumentStore({ initialContent: "" });
      const first = store.openFile("C:\\docs\\a.adoc", "本文A");
      store.openUntitled(); // 別のタブに切り替えておく
      const second = store.openFile("C:\\docs\\a.adoc", "本文A");
      expect(second.alreadyOpen).toBe(true);
      expect(second.doc.id).toBe(first.doc.id);
      expect(store.activeDoc().id).toBe(first.doc.id);
      expect(store.list()).toHaveLength(3); // 初期 + a.adoc + Untitled
    });
  });

  describe("dirty 判定", () => {
    it("内容が保存時と異なれば dirty になる", () => {
      const store = createDocumentStore({ initialContent: "" });
      const { doc } = store.openFile("a.adoc", "元の内容");
      store.updateContent(doc.id, "編集した内容");
      expect(store.isDirty(doc.id)).toBe(true);
    });

    it("内容を保存時と同じに戻せば dirty ではなくなる", () => {
      const store = createDocumentStore({ initialContent: "" });
      const { doc } = store.openFile("a.adoc", "元の内容");
      store.updateContent(doc.id, "編集した内容");
      store.updateContent(doc.id, "元の内容");
      expect(store.isDirty(doc.id)).toBe(false);
    });

    it("markSaved で保存を記録すると dirty ではなくなる", () => {
      const store = createDocumentStore({ initialContent: "" });
      const { doc } = store.openFile("a.adoc", "元の内容");
      store.updateContent(doc.id, "編集した内容");
      store.markSaved(doc.id, "編集した内容");
      expect(store.isDirty(doc.id)).toBe(false);
    });

    it("名前を付けて保存(markSaved に path を渡す)で Untitled にパスが付く", () => {
      const store = createDocumentStore({ initialContent: "" });
      const doc = store.openUntitled();
      store.updateContent(doc.id, "新しい文書");
      store.markSaved(doc.id, "新しい文書", "C:\\docs\\new.adoc");
      expect(store.activeDoc().path).toBe("C:\\docs\\new.adoc");
      expect(store.isDirty(doc.id)).toBe(false);
    });
  });

  describe("updateContent: dirty 状態が変化したかを返す", () => {
    it("保存済みの文書を編集して dirty になると true を返す", () => {
      const store = createDocumentStore({ initialContent: "" });
      const { doc } = store.openFile("a.adoc", "元の内容");
      expect(store.updateContent(doc.id, "編集した内容")).toBe(true);
    });

    it("すでに dirty な文書をさらに編集しても false を返す(dirty→dirty)", () => {
      const store = createDocumentStore({ initialContent: "" });
      const { doc } = store.openFile("a.adoc", "元の内容");
      store.updateContent(doc.id, "編集した内容1");
      expect(store.updateContent(doc.id, "編集した内容2")).toBe(false);
    });

    it("dirty な文書を保存時と同じ内容に戻すと true を返す(dirty→非dirty)", () => {
      const store = createDocumentStore({ initialContent: "" });
      const { doc } = store.openFile("a.adoc", "元の内容");
      store.updateContent(doc.id, "編集した内容");
      expect(store.updateContent(doc.id, "元の内容")).toBe(true);
    });

    it("存在しない id を指定すると false を返す", () => {
      const store = createDocumentStore({ initialContent: "" });
      expect(store.updateContent(9999, "内容")).toBe(false);
    });
  });

  describe("hasDirty: いずれかのタブに未保存の変更があるか", () => {
    it("すべてのタブが保存済みなら false", () => {
      const store = createDocumentStore({ initialContent: "" });
      store.openFile("a.adoc", "本文A");
      expect(store.hasDirty()).toBe(false);
    });

    it("非アクティブなタブが dirty なだけでも true になる", () => {
      const store = createDocumentStore({ initialContent: "" });
      const { doc } = store.openFile("a.adoc", "元の内容");
      store.updateContent(doc.id, "編集した内容");
      store.openUntitled(); // 別タブに切り替えても a.adoc の dirty は残る
      expect(store.hasDirty()).toBe(true);
    });

    it("dirty を保存し直すと false に戻る", () => {
      const store = createDocumentStore({ initialContent: "" });
      const { doc } = store.openFile("a.adoc", "元の内容");
      store.updateContent(doc.id, "編集した内容");
      store.markSaved(doc.id, "編集した内容");
      expect(store.hasDirty()).toBe(false);
    });
  });

  describe("activate: タブの切り替え", () => {
    it("指定したタブがアクティブになる", () => {
      const store = createDocumentStore({ initialContent: "" });
      const firstId = store.activeDoc().id;
      store.openUntitled();
      store.activate(firstId);
      expect(store.activeDoc().id).toBe(firstId);
    });

    it("存在しない ID を指定しても何も起きない", () => {
      const store = createDocumentStore({ initialContent: "" });
      const activeId = store.activeDoc().id;
      store.activate(9999);
      expect(store.activeDoc().id).toBe(activeId);
    });
  });

  describe("close: タブを閉じる", () => {
    it("アクティブタブを閉じると右隣のタブがアクティブになる", () => {
      const store = createDocumentStore({ initialContent: "" });
      const first = store.activeDoc();
      const second = store.openUntitled();
      const third = store.openUntitled();
      store.activate(second.id);
      store.close(second.id);
      expect(store.activeDoc().id).toBe(third.id);
      expect(store.list().map((d) => d.id)).toEqual([first.id, third.id]);
    });

    it("右端のアクティブタブを閉じると左隣がアクティブになる", () => {
      const store = createDocumentStore({ initialContent: "" });
      const first = store.activeDoc();
      const second = store.openUntitled();
      store.close(second.id);
      expect(store.activeDoc().id).toBe(first.id);
    });

    it("非アクティブのタブを閉じてもアクティブタブは変わらない", () => {
      const store = createDocumentStore({ initialContent: "" });
      const first = store.activeDoc();
      const second = store.openUntitled();
      store.close(first.id);
      expect(store.activeDoc().id).toBe(second.id);
    });

    it("最後の 1 枚を閉じると空の Untitled が自動で作られる(タブが 0 にならない)", () => {
      const store = createDocumentStore({ initialContent: "内容あり" });
      const onlyId = store.activeDoc().id;
      store.close(onlyId);
      expect(store.list()).toHaveLength(1);
      const fresh = store.activeDoc();
      expect(fresh.id).not.toBe(onlyId);
      expect(fresh.content).toBe("");
      expect(fresh.path).toBeUndefined();
    });
  });

  describe("activateNext: 次のタブへ(Ctrl+Tab)", () => {
    it("次のタブに切り替わり、右端からは先頭に循環する", () => {
      const store = createDocumentStore({ initialContent: "" });
      const first = store.activeDoc();
      const second = store.openUntitled();
      store.activate(first.id);
      store.activateNext();
      expect(store.activeDoc().id).toBe(second.id);
      store.activateNext();
      expect(store.activeDoc().id).toBe(first.id);
    });

    it("タブが 1 枚ならアクティブは変わらない", () => {
      const store = createDocumentStore({ initialContent: "" });
      const only = store.activeDoc();
      store.activateNext();
      expect(store.activeDoc().id).toBe(only.id);
    });
  });
});
