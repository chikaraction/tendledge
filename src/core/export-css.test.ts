import { describe, expect, it } from "vitest";
import { extractLightAdocCss } from "./export-css";

describe("extractLightAdocCss: スタンドアロン HTML エクスポート用のライト固定 CSS 抽出", () => {
  it(":root ブロックをそのまま含める(ライトのデフォルト変数)", () => {
    const css = `:root {\n  --bg: #ffffff;\n}\n`;
    expect(extractLightAdocCss(css)).toContain(":root {\n  --bg: #ffffff;\n}");
  });

  it(".adoc を含むセレクタのルールを含める", () => {
    const css = `.adoc .admonitionblock {\n  color: red;\n}\n`;
    expect(extractLightAdocCss(css)).toContain(".adoc .admonitionblock {\n  color: red;\n}");
  });

  it("複合セレクタ(カンマ区切り)で一方に .adoc を含む場合も含める", () => {
    const css = `.adoc .a,\n.adoc .b {\n  color: red;\n}\n`;
    const result = extractLightAdocCss(css);
    expect(result).toContain(".adoc .a,\n.adoc .b {\n  color: red;\n}");
  });

  it(".adoc を含まない無関係なセレクタは除外する", () => {
    const css = `.tab {\n  color: blue;\n}\n`;
    expect(extractLightAdocCss(css)).not.toContain("color: blue");
  });

  it("@media ブロックは(中身に .adoc があっても)まるごと除外する(印刷専用上書き・ダーク自動追従の漏れ防止)", () => {
    const css = `
@media print {
  .adoc {
    max-width: none;
  }
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #000000;
  }
}
.adoc .content {
  color: green;
}
`;
    const result = extractLightAdocCss(css);
    expect(result).not.toContain("max-width");
    expect(result).not.toContain("#000000");
    expect(result).toContain(".adoc .content");
  });

  it(":root[data-theme=\"dark\"] のような属性付き :root は除外する(選択なし=常にライト)", () => {
    const css = `:root[data-theme="dark"] {\n  --bg: #000000;\n}\n`;
    expect(extractLightAdocCss(css)).not.toContain("#000000");
  });

  it("コメント内の中括弧に惑わされない", () => {
    const css = `/* comment with { and } inside */\n.adoc .a {\n  color: red;\n}\n`;
    const result = extractLightAdocCss(css);
    expect(result).toContain(".adoc .a");
    expect(result).not.toContain("comment with");
  });

  it("複数ルールを両方とも正しく抽出する", () => {
    const css = `.adoc .a {\n  color: red;\n}\n.tab {\n  color: blue;\n}\n.adoc .b {\n  color: green;\n}\n`;
    const result = extractLightAdocCss(css);
    expect(result).toContain(".adoc .a");
    expect(result).toContain(".adoc .b");
    expect(result).not.toContain("color: blue");
  });
});
