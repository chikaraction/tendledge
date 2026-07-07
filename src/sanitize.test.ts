// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { convertToPreviewHtml, sanitizeMermaidSvg, sanitizePreviewHtml } from "./render";

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

  // シンタックスハイライト(ui/code-highlight.ts)は data-lang とコードブロックの
  // class 属性を頼りに動くため、DOMPurify がこれらを落とさないことを固定する
  it("コードブロックの class・data-lang 属性は保持する(シンタックスハイライトの前提)", () => {
    const source = ["[source,javascript]", "----", "const x = 1;", "----"].join("\n");
    const sanitized = sanitizePreviewHtml(convertToPreviewHtml(source));
    expect(sanitized).toContain('class="highlight"');
    expect(sanitized).toContain('data-lang="javascript"');
  });
});

// mermaid の生成 SVG はサニタイズ済み DOM のテキスト起点なので理論上安全だが、
// mermaid 側の脆弱性への保険として挿入前に SVG プロファイルで再サニタイズする。
describe("sanitizeMermaidSvg: mermaid 生成 SVG のサニタイズ", () => {
  it("script タグを除去する", () => {
    const svg = '<svg viewBox="0 0 10 10"><script>window.pwned = true</script><text>A</text></svg>';
    const sanitized = sanitizeMermaidSvg(svg);
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("<text>");
  });

  it("イベント属性(onclick 等)を除去する", () => {
    const svg = '<svg><a onclick="window.pwned = true"><text>x</text></a></svg>';
    expect(sanitizeMermaidSvg(svg)).not.toContain("onclick");
  });

  it("foreignObject を除去する(htmlLabels 無効化により図はこれに依存しない)", () => {
    const svg = "<svg><foreignObject><div>label</div></foreignObject><text>A</text></svg>";
    const sanitized = sanitizeMermaidSvg(svg);
    expect(sanitized).not.toContain("foreignObject");
    expect(sanitized).toContain("<text>");
  });

  it("mermaid の配色が載る style 要素と描画要素(g/rect/path/text/marker)は残す", () => {
    const svg =
      '<svg viewBox="0 0 10 10"><style>.node { fill: red; }</style>' +
      '<marker id="arrow"><path d="M0,0"/></marker>' +
      '<g class="node"><rect width="10" height="10"/><text>A</text></g></svg>';
    const sanitized = sanitizeMermaidSvg(svg);
    expect(sanitized).toContain("<style>");
    expect(sanitized).toContain("<marker");
    expect(sanitized).toContain("<rect");
    expect(sanitized).toContain("<text>");
  });
});
