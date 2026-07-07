import { describe, expect, it } from "vitest";
import { resolveHighlightLanguage, SUPPORTED_LANGUAGES } from "./highlight-lang";

describe("resolveHighlightLanguage: data-lang からハイライト対象言語を解決する", () => {
  it("対応言語セットに含まれる正規名はそのまま返す", () => {
    expect(resolveHighlightLanguage("javascript")).toBe("javascript");
    expect(resolveHighlightLanguage("python")).toBe("python");
  });

  it("大文字小文字を無視する", () => {
    expect(resolveHighlightLanguage("JavaScript")).toBe("javascript");
    expect(resolveHighlightLanguage("JSON")).toBe("json");
  });

  it("エイリアスを正規名へ解決する", () => {
    expect(resolveHighlightLanguage("js")).toBe("javascript");
    expect(resolveHighlightLanguage("jsx")).toBe("javascript");
    expect(resolveHighlightLanguage("ts")).toBe("typescript");
    expect(resolveHighlightLanguage("tsx")).toBe("typescript");
    expect(resolveHighlightLanguage("sh")).toBe("bash");
    expect(resolveHighlightLanguage("shell")).toBe("bash");
    expect(resolveHighlightLanguage("zsh")).toBe("bash");
    expect(resolveHighlightLanguage("html")).toBe("xml");
    expect(resolveHighlightLanguage("svg")).toBe("xml");
    expect(resolveHighlightLanguage("yml")).toBe("yaml");
    expect(resolveHighlightLanguage("c++")).toBe("cpp");
    expect(resolveHighlightLanguage("c#")).toBe("csharp");
    expect(resolveHighlightLanguage("toml")).toBe("ini");
    expect(resolveHighlightLanguage("docker")).toBe("dockerfile");
  });

  it("未対応の言語は undefined を返す(プレーン表示にフォールバック)", () => {
    expect(resolveHighlightLanguage("brainfuck")).toBeUndefined();
    expect(resolveHighlightLanguage("plantuml")).toBeUndefined();
  });

  it("mermaid は図として別処理されるためハイライト対象にしない", () => {
    expect(resolveHighlightLanguage("mermaid")).toBeUndefined();
  });

  it("null・空文字は undefined を返す([source] 言語なし・無印リテラルブロック相当)", () => {
    expect(resolveHighlightLanguage(null)).toBeUndefined();
    expect(resolveHighlightLanguage("")).toBeUndefined();
  });

  it("前後の空白は無視する", () => {
    expect(resolveHighlightLanguage("  js  ")).toBe("javascript");
  });

  it("SUPPORTED_LANGUAGES に含まれるどの正規名も自分自身に解決される", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(resolveHighlightLanguage(lang)).toBe(lang);
    }
  });
});
