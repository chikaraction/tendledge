import { describe, expect, it } from "vitest";
import { countCharacters, formatCharCount } from "./doc-stats";

describe("countCharacters: ステータスバーに表示する文字数", () => {
  it("通常のテキストは文字数をそのまま数える", () => {
    expect(countCharacters("あいうえお")).toBe(5);
  });

  it("改行(LF)は文字数に含めない", () => {
    expect(countCharacters("あい\nうえ\nお")).toBe(5);
  });

  it("CRLF の改行も文字数に含めない", () => {
    expect(countCharacters("ab\r\ncd")).toBe(4);
  });

  it("空文字列は 0", () => {
    expect(countCharacters("")).toBe(0);
  });

  it("サロゲートペア(絵文字など)は 1 文字と数える", () => {
    expect(countCharacters("🎉🎉")).toBe(2);
  });

  it("空白やタブは文字として数える", () => {
    expect(countCharacters("a b\tc")).toBe(5);
  });
});

describe("formatCharCount: 文字数の表示文字列", () => {
  it("3桁区切りのカンマを付けて「文字」を添える", () => {
    expect(formatCharCount(1240)).toBe("1,240 文字");
  });

  it("3桁以下はそのまま", () => {
    expect(formatCharCount(0)).toBe("0 文字");
    expect(formatCharCount(999)).toBe("999 文字");
  });

  it("100万超も桁区切りされる", () => {
    expect(formatCharCount(1234567)).toBe("1,234,567 文字");
  });
});
