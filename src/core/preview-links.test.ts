import { describe, expect, it } from "vitest";
import { classifyPreviewLink, resolveImagePath } from "./preview-links";

const DOC = "C:\\vault\\sample\\00-index.adoc";

describe("classifyPreviewLink: プレビュー内リンクの分類", () => {
  it("href がなければ何もしない", () => {
    expect(classifyPreviewLink(null, DOC)).toEqual({ kind: "none" });
  });

  describe("アンカー(#)", () => {
    it("# 始まりはプレビュー内アンカーとして扱う", () => {
      expect(classifyPreviewLink("#sec-conclusion", DOC)).toEqual({
        kind: "anchor",
        id: "sec-conclusion",
      });
    });

    it("# だけのリンクは何もしない", () => {
      expect(classifyPreviewLink("#", DOC)).toEqual({ kind: "none" });
    });
  });

  describe("外部 URL", () => {
    it("https はシステム側で開く", () => {
      expect(classifyPreviewLink("https://asciidoctor.org", DOC)).toEqual({
        kind: "external",
        url: "https://asciidoctor.org",
      });
    });

    it("http / mailto も外部として扱う", () => {
      expect(classifyPreviewLink("http://example.com", DOC).kind).toBe("external");
      expect(classifyPreviewLink("mailto:a@example.com", DOC).kind).toBe("external");
    });

    it("その他のスキーム(file: 等)は安全側に倒して何もしない", () => {
      expect(classifyPreviewLink("file:///C:/secret.txt", DOC)).toEqual({ kind: "none" });
      expect(classifyPreviewLink("javascript:alert(1)", DOC)).toEqual({ kind: "none" });
    });
  });

  describe("相対パス(別ファイルを開く)", () => {
    it("対応拡張子の相対パスは現在の文書のディレクトリ基準で解決する", () => {
      expect(classifyPreviewLink("01-headings-and-text.adoc", DOC)).toEqual({
        kind: "open-file",
        path: "C:\\vault\\sample\\01-headings-and-text.adoc",
      });
    });

    it("../ を含む相対パスも解決する", () => {
      expect(classifyPreviewLink("../notes/memo.adoc", DOC)).toEqual({
        kind: "open-file",
        path: "C:\\vault\\notes\\memo.adoc",
      });
    });

    it("アンカー付き(file.adoc#sec)はファイル部分だけを使う", () => {
      expect(classifyPreviewLink("01-headings-and-text.adoc#sec", DOC)).toEqual({
        kind: "open-file",
        path: "C:\\vault\\sample\\01-headings-and-text.adoc",
      });
    });

    it("パーセントエンコードされたファイル名を復元する", () => {
      expect(classifyPreviewLink("%E3%83%A1%E3%83%A2.adoc", DOC)).toEqual({
        kind: "open-file",
        path: "C:\\vault\\sample\\メモ.adoc",
      });
    });

    it("対応外の拡張子は何もしない", () => {
      expect(classifyPreviewLink("image.png", DOC)).toEqual({ kind: "none" });
      expect(classifyPreviewLink("report.pdf", DOC)).toEqual({ kind: "none" });
    });

    it("現在の文書がパスを持たない(無題)場合は何もしない", () => {
      expect(classifyPreviewLink("01-headings-and-text.adoc", undefined)).toEqual({
        kind: "none",
      });
    });
  });
});

describe("resolveImagePath: プレビュー画像の相対パス解決", () => {
  it("相対パスは現在の文書のディレクトリ基準の絶対パスにする", () => {
    expect(resolveImagePath("images/logo.svg", DOC)).toBe(
      "C:\\vault\\sample\\images\\logo.svg",
    );
  });

  it("../ を含む相対パスも解決する", () => {
    expect(resolveImagePath("../shared/logo.png", DOC)).toBe("C:\\vault\\shared\\logo.png");
  });

  it("URL(https / data:)はそのまま扱うため undefined を返す", () => {
    expect(resolveImagePath("https://example.com/a.png", DOC)).toBeUndefined();
    expect(resolveImagePath("data:image/png;base64,xxxx", DOC)).toBeUndefined();
  });

  it("絶対パス風(/ や \\ 始まり)は変換しない", () => {
    expect(resolveImagePath("/usr/share/a.png", DOC)).toBeUndefined();
  });

  it("現在の文書がパスを持たない(無題)場合は変換しない", () => {
    expect(resolveImagePath("images/logo.svg", undefined)).toBeUndefined();
  });

  it("パーセントエンコードされたファイル名を復元する", () => {
    expect(resolveImagePath("images/%E5%9B%B3.png", DOC)).toBe(
      "C:\\vault\\sample\\images\\図.png",
    );
  });
});
