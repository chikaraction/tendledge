import { describe, expect, it } from "vitest";
import {
  KROKI_LANGS,
  krokiCacheKey,
  krokiDiagramType,
  krokiRequestUrl,
  svgToDataUri,
} from "./kroki";

describe("KROKI_LANGS: Kroki 経由でレンダリングする言語の一覧", () => {
  it("plantuml と drawio を含む", () => {
    expect(KROKI_LANGS).toEqual(["plantuml", "drawio"]);
  });
});

describe("krokiDiagramType: data-lang から Kroki の図種別名を解決する", () => {
  it("plantuml はそのまま plantuml", () => {
    expect(krokiDiagramType("plantuml")).toBe("plantuml");
  });

  it("drawio は Kroki 側の呼称 diagramsnet に変換する", () => {
    expect(krokiDiagramType("drawio")).toBe("diagramsnet");
  });

  it("対応外の言語は undefined を返す", () => {
    expect(krokiDiagramType("mermaid")).toBeUndefined();
    expect(krokiDiagramType("unknown")).toBeUndefined();
  });
});

describe("krokiRequestUrl: サーバー URL と言語からリクエスト URL を組み立てる", () => {
  it("末尾スラッシュなしのサーバー URL を正しく組み立てる", () => {
    expect(krokiRequestUrl("https://kroki.io", "plantuml")).toBe(
      "https://kroki.io/plantuml/svg",
    );
  });

  it("末尾スラッシュを正規化する", () => {
    expect(krokiRequestUrl("https://kroki.io/", "plantuml")).toBe(
      "https://kroki.io/plantuml/svg",
    );
  });

  it("drawio は diagramsnet エンドポイントに解決する", () => {
    expect(krokiRequestUrl("https://kroki.io", "drawio")).toBe(
      "https://kroki.io/diagramsnet/svg",
    );
  });

  it("self-host のポート付き URL でも組み立てられる", () => {
    expect(krokiRequestUrl("http://localhost:8000", "plantuml")).toBe(
      "http://localhost:8000/plantuml/svg",
    );
  });

  it("対応外の言語では undefined を返す", () => {
    expect(krokiRequestUrl("https://kroki.io", "mermaid")).toBeUndefined();
  });
});

describe("krokiCacheKey: サーバー・言語・ソースからキャッシュキーを作る", () => {
  it("同じ入力なら同じキーになる", () => {
    const a = krokiCacheKey("https://kroki.io", "plantuml", "Alice -> Bob");
    const b = krokiCacheKey("https://kroki.io", "plantuml", "Alice -> Bob");
    expect(a).toBe(b);
  });

  it("サーバーが違えば別のキーになる(サーバー切り替え後に古い結果を返さないため)", () => {
    const a = krokiCacheKey("https://kroki.io", "plantuml", "Alice -> Bob");
    const b = krokiCacheKey("http://localhost:8000", "plantuml", "Alice -> Bob");
    expect(a).not.toBe(b);
  });

  it("言語が違えば別のキーになる", () => {
    const a = krokiCacheKey("https://kroki.io", "plantuml", "same");
    const b = krokiCacheKey("https://kroki.io", "drawio", "same");
    expect(a).not.toBe(b);
  });

  it("ソースが違えば別のキーになる", () => {
    const a = krokiCacheKey("https://kroki.io", "plantuml", "A");
    const b = krokiCacheKey("https://kroki.io", "plantuml", "B");
    expect(a).not.toBe(b);
  });
});

describe("svgToDataUri: SVG 文字列を data URI に変換する", () => {
  it("data:image/svg+xml;base64, で始まる", () => {
    const uri = svgToDataUri("<svg></svg>");
    expect(uri.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  it("base64 部分をデコードすると元の SVG 文字列に戻る", () => {
    const svg = '<svg><text>hello</text></svg>';
    const uri = svgToDataUri(svg);
    const base64 = uri.slice("data:image/svg+xml;base64,".length);
    expect(atob(base64)).toBe(svg);
  });

  it("マルチバイト文字(日本語ラベル等)を含む SVG も往復できる", () => {
    const svg = '<svg><text>こんにちは</text></svg>';
    const uri = svgToDataUri(svg);
    const base64 = uri.slice("data:image/svg+xml;base64,".length);
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toBe(svg);
  });
});
