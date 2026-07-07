// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { convertToPreviewHtml, convertToStandaloneHtml } from "./render";

// [mermaid] ブロックはブロック拡張で [source,mermaid] と同一の出力に正規化される。
// 素の Asciidoctor では [mermaid] スタイルは HTML に痕跡を残さない(ただの
// listingblock になる)ため、この正規化が後段の図レンダリングの前提になる。
describe("convertToPreviewHtml: [mermaid] ブロックの正規化", () => {
  it("[mermaid] + ---- が data-lang=\"mermaid\" 付きのコードブロックになる", () => {
    const source = ["[mermaid]", "----", "graph TD; A-->B;", "----"].join("\n");
    const html = convertToPreviewHtml(source);
    expect(html).toContain('data-lang="mermaid"');
    expect(html).toContain("graph TD; A--&gt;B;"); // 図ソースはエスケープされて保持
  });

  it("[mermaid] + ....(literal ブロック)でも同様に正規化される", () => {
    const source = ["[mermaid]", "....", "graph TD; A-->B;", "...."].join("\n");
    const html = convertToPreviewHtml(source);
    expect(html).toContain('data-lang="mermaid"');
  });

  it("[source,mermaid] と同一の HTML になる", () => {
    const block = ["----", "sequenceDiagram", "  A->>B: hello", "----"];
    const fromStyle = convertToPreviewHtml(["[mermaid]", ...block].join("\n"));
    const fromSource = convertToPreviewHtml(["[source,mermaid]", ...block].join("\n"));
    expect(fromStyle).toBe(fromSource);
  });

  it("複数回 convert しても正規化が効き続ける(registry 渡し方式は2回目から素通しになるため)", () => {
    const source = ["[mermaid]", "----", "graph TD; A-->B;", "----"].join("\n");
    convertToPreviewHtml(source); // 1回目
    const second = convertToPreviewHtml(source); // プレビューは打鍵ごとに convert する
    expect(second).toContain('data-lang="mermaid"');
  });

  it("mermaid 以外のブロックスタイルには影響しない", () => {
    const source = ["[source,js]", "----", "const a = 1;", "----"].join("\n");
    const html = convertToPreviewHtml(source);
    expect(html).toContain('data-lang="js"');
    expect(html).not.toContain("mermaid");
  });
});

describe("convertToStandaloneHtml: [mermaid] ブロックの正規化", () => {
  it("standalone 出力にも data-lang=\"mermaid\" が含まれる(エクスポート焼き込みの前提)", () => {
    const source = ["= 文書", "", "[mermaid]", "----", "graph TD; A-->B;", "----"].join("\n");
    const html = convertToStandaloneHtml(source);
    expect(html).toContain('data-lang="mermaid"');
  });
});
