import { describe, expect, it } from "vitest";
import {
  type AnchorPoint,
  editorLineForPreviewScrollTop,
  previewScrollTopForLine,
} from "./scroll-sync";

// 典型的なアンカー構成: 行10 が 100px、行50 が 500px、行90 が 900px に対応
const anchors: AnchorPoint[] = [
  { lineno: 10, offset: 100 },
  { lineno: 50, offset: 500 },
  { lineno: 90, offset: 900 },
];
const TOTAL_LINES = 100;
const MAX_SCROLL = 1000;

describe("previewScrollTopForLine: エディタ行 → プレビュー scrollTop", () => {
  describe("アンカーがない場合(見出しのない文書)", () => {
    it("行位置の割合で全体を比例配分する", () => {
      // 100行中の51行目 = 50/99 の位置
      expect(previewScrollTopForLine(51, 100, [], 990)).toBeCloseTo(500);
    });

    it("1行しかない文書では常に先頭(0)を返す", () => {
      expect(previewScrollTopForLine(1, 1, [], 1000)).toBe(0);
    });
  });

  describe("最初のアンカーより上の領域", () => {
    it("文書先頭から最初のアンカーまでを線形に補間する", () => {
      // 行5 は最初のアンカー(行10 = 100px)の半分 → 50px
      expect(previewScrollTopForLine(5, TOTAL_LINES, anchors, MAX_SCROLL)).toBeCloseTo(50);
    });

    it("最初のアンカー行ちょうどならアンカーのオフセットを返す", () => {
      expect(previewScrollTopForLine(10, TOTAL_LINES, anchors, MAX_SCROLL)).toBeCloseTo(100);
    });
  });

  describe("アンカーとアンカーの間", () => {
    it("2つのアンカー間を線形に補間する", () => {
      // 行30 は 行10(100px)と行50(500px)の中間 → 300px
      expect(previewScrollTopForLine(30, TOTAL_LINES, anchors, MAX_SCROLL)).toBeCloseTo(300);
    });
  });

  describe("最後のアンカーより下の領域", () => {
    it("最後のアンカーから maxScroll までを残り行数で補間する", () => {
      // 行95 は 行90(900px)〜行100(1000px)の中間 → 950px
      expect(previewScrollTopForLine(95, TOTAL_LINES, anchors, MAX_SCROLL)).toBeCloseTo(950);
    });

    it("最終行なら maxScroll に到達する", () => {
      expect(previewScrollTopForLine(100, TOTAL_LINES, anchors, MAX_SCROLL)).toBeCloseTo(1000);
    });
  });

  describe("縮退ケース", () => {
    it("同じ行番号のアンカーが並んでいてもゼロ除算しない", () => {
      const degenerate: AnchorPoint[] = [
        { lineno: 10, offset: 100 },
        { lineno: 10, offset: 200 },
      ];
      expect(() => previewScrollTopForLine(10, 100, degenerate, 1000)).not.toThrow();
    });
  });
});

describe("editorLineForPreviewScrollTop: プレビュー scrollTop → エディタ行", () => {
  describe("アンカーがない場合", () => {
    it("スクロール割合で行番号を比例配分する", () => {
      expect(editorLineForPreviewScrollTop(500, 100, [], 990)).toBe(51); // round(1 + 500/990*99)
    });

    it("スクロール不能(maxScroll <= 0)なら 1 行目を返す", () => {
      expect(editorLineForPreviewScrollTop(0, 100, [], 0)).toBe(1);
    });
  });

  describe("アンカーがある場合", () => {
    it("最初のアンカーより上は先頭から線形補間する", () => {
      expect(editorLineForPreviewScrollTop(50, TOTAL_LINES, anchors, MAX_SCROLL)).toBe(5);
    });

    it("アンカー間は線形補間する", () => {
      expect(editorLineForPreviewScrollTop(300, TOTAL_LINES, anchors, MAX_SCROLL)).toBe(30);
    });

    it("最後のアンカーより下は maxScroll までの残りで補間する", () => {
      expect(editorLineForPreviewScrollTop(950, TOTAL_LINES, anchors, MAX_SCROLL)).toBe(95);
    });
  });

  describe("相互変換の整合性", () => {
    it("行 → scrollTop → 行 と往復しても(丸め誤差の範囲で)元の行に戻る", () => {
      for (const line of [5, 10, 30, 50, 70, 90, 95]) {
        const scrollTop = previewScrollTopForLine(line, TOTAL_LINES, anchors, MAX_SCROLL);
        const back = editorLineForPreviewScrollTop(scrollTop, TOTAL_LINES, anchors, MAX_SCROLL);
        expect(Math.abs(back - line)).toBeLessThanOrEqual(1);
      }
    });
  });
});
