import { describe, expect, it } from "vitest";
import { renderBylineHtml } from "./byline";

describe("renderBylineHtml: 著者バイラインの HTML 生成", () => {
  it("著者・リビジョンとも情報が無ければ空文字列", () => {
    expect(renderBylineHtml({ authors: [] })).toBe("");
  });

  it("著者1人(email なし)は id なしの author span のみ", () => {
    const html = renderBylineHtml({ authors: [{ name: "山田太郎" }] });
    expect(html).toBe(
      '<div class="details">\n<span id="author" class="author">山田太郎</span><br>\n</div>',
    );
  });

  it("著者1人(email あり)は author span の直後に mailto リンクの email span が続く", () => {
    const html = renderBylineHtml({
      authors: [{ name: "山田太郎", email: "yamada@example.com" }],
    });
    expect(html).toBe(
      [
        '<div class="details">',
        '<span id="author" class="author">山田太郎</span><br>',
        '<span id="email" class="email"><a href="mailto:yamada@example.com">yamada@example.com</a></span><br>',
        "</div>",
      ].join("\n"),
    );
  });

  it("著者2人目以降は id に連番が付く(author2/email2。アンダースコア区切りではない)", () => {
    const html = renderBylineHtml({
      authors: [
        { name: "山田太郎", email: "yamada@example.com" },
        { name: "鈴木花子", email: "suzuki@example.com" },
      ],
    });
    expect(html).toContain('<span id="author" class="author">山田太郎</span><br>');
    expect(html).toContain('<span id="email" class="email">');
    expect(html).toContain('<span id="author2" class="author">鈴木花子</span><br>');
    expect(html).toContain(
      '<span id="email2" class="email"><a href="mailto:suzuki@example.com">suzuki@example.com</a></span><br>',
    );
  });

  it("3人目は author3/email3", () => {
    const html = renderBylineHtml({
      authors: [{ name: "A" }, { name: "B" }, { name: "C", email: "c@example.com" }],
    });
    expect(html).toContain('<span id="author3" class="author">C</span><br>');
    expect(html).toContain('<span id="email3" class="email">');
  });

  it("revnumber と revdate が両方あれば「version X,」の形でカンマが付く", () => {
    const html = renderBylineHtml({
      authors: [{ name: "山田太郎" }],
      revision: { number: "1.0", date: "2026-07-14" },
    });
    expect(html).toContain('<span id="revnumber">version 1.0,</span>');
    expect(html).toContain('<span id="revdate">2026-07-14</span>');
  });

  it("revnumber のみ(revdate なし)ならカンマは付かない", () => {
    const html = renderBylineHtml({
      authors: [{ name: "山田太郎" }],
      revision: { number: "1.0" },
    });
    expect(html).toContain('<span id="revnumber">version 1.0</span>');
    expect(html).not.toContain("1.0,");
  });

  it("revremark は直前に単独の <br> が付く", () => {
    const html = renderBylineHtml({
      authors: [{ name: "山田太郎" }],
      revision: { number: "1.0", date: "2026-07-14", remark: "初版" },
    });
    expect(html).toContain('<br><span id="revremark">初版</span>');
  });

  it("著者が0人でもリビジョン情報だけで details が出る", () => {
    const html = renderBylineHtml({ authors: [], revision: { date: "2026-07-14" } });
    expect(html).toBe('<div class="details">\n<span id="revdate">2026-07-14</span>\n</div>');
  });

  it("revision オブジェクトが存在してもプロパティが全て undefined なら何も出さない", () => {
    const html = renderBylineHtml({ authors: [], revision: {} });
    expect(html).toBe("");
  });

  it("著者名・email・リビジョンの各フィールドを HTML エスケープする", () => {
    const html = renderBylineHtml({
      authors: [{ name: '<script>alert("x")</script>', email: 'a"b@example.com' }],
      revision: { remark: "<b>注記</b>" },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a&quot;b@example.com");
    expect(html).toContain("&lt;b&gt;注記&lt;/b&gt;");
  });
});
