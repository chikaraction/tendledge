// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { convertToPreviewHtml, sanitizePreviewHtml } from "./render";

// 保管庫機能で第三者の .adoc を開く前提のため、プレビューは信頼できない入力として扱う。
// AsciiDoc のパススルーブロック(++++)は safe: "safe" でも生 HTML を素通しするので、
// DOMPurify によるサニタイズが唯一の防壁になる。
describe("sanitizePreviewHtml: プレビュー HTML のサニタイズ", () => {
  it("パススルーブロック内の script タグを除去する", () => {
    const source = ["= 悪意ある文書", "", "++++", "<script>window.pwned = true</script>", "++++"].join(
      "\n",
    );
    const html = convertToPreviewHtml(source);
    expect(html).toContain("<script>"); // Asciidoctor は素通しする(前提の確認)
    expect(sanitizePreviewHtml(html)).not.toContain("<script>");
  });

  it("インラインイベントハンドラ(onerror 等)を除去する", () => {
    const source = ["++++", '<img src="x" onerror="window.pwned = true">', "++++"].join("\n");
    const sanitized = sanitizePreviewHtml(convertToPreviewHtml(source));
    expect(sanitized).not.toContain("onerror");
  });

  it("javascript: スキームのリンクを無害化する", () => {
    const source = ["++++", '<a href="javascript:alert(1)">click</a>', "++++"].join("\n");
    const sanitized = sanitizePreviewHtml(convertToPreviewHtml(source));
    expect(sanitized).not.toContain("javascript:");
  });

  it("通常の AsciiDoc 出力(見出し・強調・表)はそのまま通す", () => {
    const source = ["= タイトル", "", "== 見出し", "", "*太字* です。", "", "|===", "| A | B", "|==="].join(
      "\n",
    );
    const html = convertToPreviewHtml(source);
    const sanitized = sanitizePreviewHtml(html);
    expect(sanitized).toContain("<h1>");
    expect(sanitized).toContain("<strong>");
    expect(sanitized).toContain("<table");
  });

  it("パススルーの安全な HTML(kbd タグ等)は残す", () => {
    const source = ["++++", "<kbd>Ctrl</kbd>+<kbd>S</kbd>", "++++"].join("\n");
    const sanitized = sanitizePreviewHtml(convertToPreviewHtml(source));
    expect(sanitized).toContain("<kbd>");
  });
});
