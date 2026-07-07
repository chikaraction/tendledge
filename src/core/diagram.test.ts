import { describe, expect, it } from "vitest";
import { mermaidCacheKey, resolveMermaidTheme } from "./diagram";

describe("resolveMermaidTheme: アプリのテーマ設定から mermaid テーマを解決する", () => {
  it("light 設定では OS 設定によらず default になる", () => {
    expect(resolveMermaidTheme("light", false)).toBe("default");
    expect(resolveMermaidTheme("light", true)).toBe("default");
  });

  it("dark 設定では OS 設定によらず dark になる", () => {
    expect(resolveMermaidTheme("dark", false)).toBe("dark");
    expect(resolveMermaidTheme("dark", true)).toBe("dark");
  });

  it("system 設定では OS のダーク判定に従う", () => {
    expect(resolveMermaidTheme("system", false)).toBe("default");
    expect(resolveMermaidTheme("system", true)).toBe("dark");
  });
});

describe("mermaidCacheKey: レンダリング結果のキャッシュキー", () => {
  it("同じテーマ・同じソースなら同じキーになる", () => {
    expect(mermaidCacheKey("default", "graph TD; A-->B;")).toBe(
      mermaidCacheKey("default", "graph TD; A-->B;"),
    );
  });

  it("テーマが違えばキーも違う(テーマ切り替えで古い配色の SVG を返さない)", () => {
    const source = "graph TD; A-->B;";
    expect(mermaidCacheKey("default", source)).not.toBe(mermaidCacheKey("dark", source));
  });

  it("ソースが違えばキーも違う", () => {
    expect(mermaidCacheKey("default", "graph TD; A-->B;")).not.toBe(
      mermaidCacheKey("default", "graph TD; A-->C;"),
    );
  });
});
