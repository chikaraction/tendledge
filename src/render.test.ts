// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { convertToPreviewHtml, convertToStandaloneHtml } from "./render";

// [mermaid] ブロックはブロック拡張で [source,mermaid] と同一の出力に正規化される。
// 素の Asciidoctor では [mermaid] スタイルは HTML に痕跡を残さない(ただの
// listingblock になる)ため、この正規化が後段の図レンダリングの前提になる。
describe("convertToPreviewHtml: [mermaid] ブロックの正規化", () => {
  it("[mermaid] + ---- が data-lang=\"mermaid\" 付きのコードブロックになる", async () => {
    const source = ["[mermaid]", "----", "graph TD; A-->B;", "----"].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).toContain('data-lang="mermaid"');
    expect(html).toContain("graph TD; A--&gt;B;"); // 図ソースはエスケープされて保持
  });

  it("[mermaid] + ....(literal ブロック)でも同様に正規化される", async () => {
    const source = ["[mermaid]", "....", "graph TD; A-->B;", "...."].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).toContain('data-lang="mermaid"');
  });

  it("[source,mermaid] と同一の HTML になる", async () => {
    const block = ["----", "sequenceDiagram", "  A->>B: hello", "----"];
    const fromStyle = await convertToPreviewHtml(["[mermaid]", ...block].join("\n"));
    const fromSource = await convertToPreviewHtml(["[source,mermaid]", ...block].join("\n"));
    expect(fromStyle).toBe(fromSource);
  });

  it("複数回 convert しても正規化が効き続ける(registry 渡し方式は2回目から素通しになるため)", async () => {
    const source = ["[mermaid]", "----", "graph TD; A-->B;", "----"].join("\n");
    await convertToPreviewHtml(source); // 1回目
    const second = await convertToPreviewHtml(source); // プレビューは打鍵ごとに convert する
    expect(second).toContain('data-lang="mermaid"');
  });

  it("mermaid 以外のブロックスタイルには影響しない", async () => {
    const source = ["[source,js]", "----", "const a = 1;", "----"].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).toContain('data-lang="js"');
    expect(html).not.toContain("mermaid");
  });

  it("ブロックタイトル(`.タイトル`)が正規化後も残る(createBlock は引き継がないため明示的に移す)", async () => {
    const source = [".シーケンス図", "[mermaid]", "----", "graph TD; A-->B;", "----"].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).toContain('<div class="title">シーケンス図</div>');
  });
});

describe("convertToStandaloneHtml: [mermaid] ブロックの正規化", () => {
  it("standalone 出力にも data-lang=\"mermaid\" が含まれる(エクスポート焼き込みの前提)", async () => {
    const source = ["= 文書", "", "[mermaid]", "----", "graph TD; A-->B;", "----"].join("\n");
    const html = await convertToStandaloneHtml(source);
    expect(html).toContain('data-lang="mermaid"');
  });
});

// [plantuml] / [drawio] も mermaid と同じ理由(素の Asciidoctor では
// スタイルが HTML に残らない)で source,<lang> に正規化する。
describe("convertToPreviewHtml: [plantuml] ブロックの正規化", () => {
  it("[plantuml] + ---- が data-lang=\"plantuml\" 付きのコードブロックになる", async () => {
    const source = ["[plantuml]", "----", "Alice -> Bob: hello", "----"].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).toContain('data-lang="plantuml"');
  });

  it("[source,plantuml] と同一の HTML になる", async () => {
    const block = ["----", "Alice -> Bob: hello", "----"];
    const fromStyle = await convertToPreviewHtml(["[plantuml]", ...block].join("\n"));
    const fromSource = await convertToPreviewHtml(["[source,plantuml]", ...block].join("\n"));
    expect(fromStyle).toBe(fromSource);
  });

  it("複数回 convert しても正規化が効き続ける", async () => {
    const source = ["[plantuml]", "----", "Alice -> Bob: hello", "----"].join("\n");
    await convertToPreviewHtml(source);
    const second = await convertToPreviewHtml(source);
    expect(second).toContain('data-lang="plantuml"');
  });

  it("ブロックタイトル(`.タイトル`)が正規化後も残る", async () => {
    const source = [".シーケンス図", "[plantuml]", "----", "Alice -> Bob: hello", "----"].join(
      "\n",
    );
    const html = await convertToPreviewHtml(source);
    expect(html).toContain('<div class="title">シーケンス図</div>');
  });
});

describe("convertToPreviewHtml: [drawio] / [diagramsnet] ブロックの正規化", () => {
  it("[drawio] + ---- が data-lang=\"drawio\" 付きのコードブロックになる", async () => {
    const source = ["[drawio]", "----", "<mxfile></mxfile>", "----"].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).toContain('data-lang="drawio"');
  });

  it("[diagramsnet] は [drawio] と同一の HTML になる(Kroki 側の呼称をエイリアスとして受ける)", async () => {
    const block = ["----", "<mxfile></mxfile>", "----"];
    const fromDrawio = await convertToPreviewHtml(["[drawio]", ...block].join("\n"));
    const fromDiagramsnet = await convertToPreviewHtml(["[diagramsnet]", ...block].join("\n"));
    expect(fromDiagramsnet).toBe(fromDrawio);
  });

  it("[source,drawio] と同一の HTML になる", async () => {
    const block = ["----", "<mxfile></mxfile>", "----"];
    const fromStyle = await convertToPreviewHtml(["[drawio]", ...block].join("\n"));
    const fromSource = await convertToPreviewHtml(["[source,drawio]", ...block].join("\n"));
    expect(fromStyle).toBe(fromSource);
  });
});

// バイライン(著者・リビジョン情報)はプレビュー・エクスポートの両方で表示する方針
// (2026-07-14 に「両方非表示」から転換。docs/export-notes.md 参照)。
// ここではプレビュー側(convertToPreviewHtml)の挿入だけを特性化する。
// マークアップの詳細(id 連番・エスケープ等)は core/byline.test.ts が担う。
describe("convertToPreviewHtml: 著者バイラインの挿入", () => {
  it(":author: 付き文書のプレビュー HTML にバイラインが含まれる", async () => {
    const source = [":author: 山田太郎", "", "= タイトル", "", "本文"].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).toContain('<div class="details">');
    expect(html).toContain('<span id="author" class="author">山田太郎</span>');
  });

  it("バイラインはタイトルの <h1> の直後に挿入される", async () => {
    const source = [":author: 山田太郎", "", "= タイトル", "", "本文"].join("\n");
    const html = await convertToPreviewHtml(source);
    const h1End = html.indexOf("</h1>") + "</h1>".length;
    const detailsStart = html.indexOf('<div class="details">');
    expect(detailsStart).toBeGreaterThan(0);
    expect(html.slice(h1End, detailsStart).trim()).toBe("");
  });

  it("author なしならバイラインは含まれない", async () => {
    const source = ["= タイトル", "", "本文"].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).not.toContain('class="details"');
  });

  it("タイトルなし文書(見出しが無く <h1> が出ない)なら author があってもバイラインを挿入しない", async () => {
    const source = [":author: 山田太郎", "", "本文だけの文書"].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).not.toContain("<h1");
    expect(html).not.toContain('class="details"');
  });

  it("リビジョン情報だけでもバイラインが含まれる", async () => {
    const source = ["= タイトル", "山田太郎", "v1.0, 2026-07-14: 初版", "", "本文"].join("\n");
    const html = await convertToPreviewHtml(source);
    expect(html).toContain('<span id="revnumber">version 1.0,</span>');
    expect(html).toContain('<span id="revremark">初版</span>');
  });
});

describe("convertToStandaloneHtml: [plantuml] / [drawio] ブロックの正規化", () => {
  it("standalone 出力にも data-lang=\"plantuml\" が含まれる", async () => {
    const source = ["= 文書", "", "[plantuml]", "----", "Alice -> Bob: hello", "----"].join("\n");
    const html = await convertToStandaloneHtml(source);
    expect(html).toContain('data-lang="plantuml"');
  });

  it("standalone 出力にも data-lang=\"drawio\" が含まれる", async () => {
    const source = ["= 文書", "", "[drawio]", "----", "<mxfile></mxfile>", "----"].join("\n");
    const html = await convertToStandaloneHtml(source);
    expect(html).toContain('data-lang="drawio"');
  });
});
