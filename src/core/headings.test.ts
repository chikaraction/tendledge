import { describe, expect, it } from "vitest";
import { extractHeadingLines } from "./headings";

describe("extractHeadingLines: AsciiDoc ソースから見出し行を抽出する", () => {
  it("文書タイトル(=)とセクション(== 以降)を 1 始まりの行番号で返す", () => {
    const source = ["= タイトル", "", "本文", "== セクション1", "本文", "=== サブセクション"].join(
      "\n",
    );
    expect(extractHeadingLines(source)).toEqual([1, 4, 6]);
  });

  it("`=` の後に空白がない行は見出しとして扱わない", () => {
    expect(extractHeadingLines("==強調ではない\n= タイトル")).toEqual([2]);
  });

  it("行頭以外の `=` は見出しとして扱わない", () => {
    expect(extractHeadingLines("本文中の = 記号\n * リスト")).toEqual([]);
  });

  it("見出しがなければ空配列を返す", () => {
    expect(extractHeadingLines("ただの本文")).toEqual([]);
  });

  it("空文字列なら空配列を返す", () => {
    expect(extractHeadingLines("")).toEqual([]);
  });

  it("【特性化】タブ区切りの見出しも許容する(\\s は空白全般にマッチ)", () => {
    expect(extractHeadingLines("=\tタイトル")).toEqual([1]);
  });
});
