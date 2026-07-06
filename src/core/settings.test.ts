import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, mergeSettings } from "./settings";

describe("DEFAULT_SETTINGS: 既定値", () => {
  it("テーマは system、フォントサイズは 14px、プレビューは 16px、フォントファミリは空(既定)、デバウンスは 300ms", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      theme: "system",
      editorFontSize: 14,
      editorFontFamily: "",
      previewFontSize: 16,
      previewFontFamily: "",
      previewDebounceMs: 300,
    });
  });
});

describe("mergeSettings: 保存値を検証してデフォルトにフォールバックする", () => {
  it("すべて正しい値ならそのまま採用する", () => {
    expect(
      mergeSettings({
        theme: "dark",
        editorFontSize: 18,
        editorFontFamily: "UDEV Gothic",
        previewFontSize: 20,
        previewFontFamily: "Noto Sans JP",
        previewDebounceMs: 500,
      }),
    ).toEqual({
      theme: "dark",
      editorFontSize: 18,
      editorFontFamily: "UDEV Gothic",
      previewFontSize: 20,
      previewFontFamily: "Noto Sans JP",
      previewDebounceMs: 500,
    });
  });

  it("null を渡すとすべてデフォルトになる", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("undefined を渡すとすべてデフォルトになる", () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("オブジェクトでない値(文字列)を渡すとすべてデフォルトになる", () => {
    expect(mergeSettings("not an object")).toEqual(DEFAULT_SETTINGS);
  });

  it("オブジェクトでない値(数値)を渡すとすべてデフォルトになる", () => {
    expect(mergeSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it("配列を渡すとすべてデフォルトになる", () => {
    expect(mergeSettings([1, 2, 3])).toEqual(DEFAULT_SETTINGS);
  });

  it("キーが欠けている場合はそのキーだけデフォルトで補う", () => {
    expect(mergeSettings({ theme: "light" })).toEqual({
      theme: "light",
      editorFontSize: 14,
      editorFontFamily: "",
      previewFontSize: 16,
      previewFontFamily: "",
      previewDebounceMs: 300,
    });
  });

  it("未知の theme 値はデフォルトの system にフォールバックする", () => {
    expect(mergeSettings({ theme: "solarized" }).theme).toBe("system");
  });

  it("theme が文字列でない場合はデフォルトにフォールバックする", () => {
    expect(mergeSettings({ theme: 123 }).theme).toBe("system");
  });

  it("editorFontSize が範囲外(小さすぎる)ならデフォルトにフォールバックする", () => {
    expect(mergeSettings({ editorFontSize: 8 }).editorFontSize).toBe(14);
  });

  it("editorFontSize が範囲外(大きすぎる)ならデフォルトにフォールバックする", () => {
    expect(mergeSettings({ editorFontSize: 73 }).editorFontSize).toBe(14);
  });

  it("editorFontSize の境界値(9, 72)は許容する", () => {
    expect(mergeSettings({ editorFontSize: 9 }).editorFontSize).toBe(9);
    expect(mergeSettings({ editorFontSize: 72 }).editorFontSize).toBe(72);
  });

  it("editorFontSize が数値でない場合はデフォルトにフォールバックする", () => {
    expect(mergeSettings({ editorFontSize: "14" }).editorFontSize).toBe(14);
  });

  it("editorFontSize が NaN の場合はデフォルトにフォールバックする", () => {
    expect(mergeSettings({ editorFontSize: NaN }).editorFontSize).toBe(14);
  });

  it("previewFontSize が範囲外(小さすぎる)ならデフォルトにフォールバックする", () => {
    expect(mergeSettings({ previewFontSize: 8 }).previewFontSize).toBe(16);
  });

  it("previewFontSize が範囲外(大きすぎる)ならデフォルトにフォールバックする", () => {
    expect(mergeSettings({ previewFontSize: 73 }).previewFontSize).toBe(16);
  });

  it("previewFontSize の境界値(9, 72)は許容する", () => {
    expect(mergeSettings({ previewFontSize: 9 }).previewFontSize).toBe(9);
    expect(mergeSettings({ previewFontSize: 72 }).previewFontSize).toBe(72);
  });

  it("previewFontSize が数値でない場合はデフォルトにフォールバックする", () => {
    expect(mergeSettings({ previewFontSize: "16" }).previewFontSize).toBe(16);
  });

  it("previewFontSize が NaN の場合はデフォルトにフォールバックする", () => {
    expect(mergeSettings({ previewFontSize: NaN }).previewFontSize).toBe(16);
  });

  it("previewDebounceMs が範囲外(小さすぎる)ならデフォルトにフォールバックする", () => {
    expect(mergeSettings({ previewDebounceMs: 99 }).previewDebounceMs).toBe(300);
  });

  it("previewDebounceMs が範囲外(大きすぎる)ならデフォルトにフォールバックする", () => {
    expect(mergeSettings({ previewDebounceMs: 2001 }).previewDebounceMs).toBe(300);
  });

  it("previewDebounceMs の境界値(100, 2000)は許容する", () => {
    expect(mergeSettings({ previewDebounceMs: 100 }).previewDebounceMs).toBe(100);
    expect(mergeSettings({ previewDebounceMs: 2000 }).previewDebounceMs).toBe(2000);
  });

  it("previewDebounceMs が数値でない場合はデフォルトにフォールバックする", () => {
    expect(mergeSettings({ previewDebounceMs: null }).previewDebounceMs).toBe(300);
  });

  it("余分なキーは無視する", () => {
    expect(mergeSettings({ theme: "dark", unknownKey: "何か" })).toEqual({
      theme: "dark",
      editorFontSize: 14,
      editorFontFamily: "",
      previewFontSize: 16,
      previewFontFamily: "",
      previewDebounceMs: 300,
    });
  });

  it("フォントファミリは文字列ならそのまま採用する(空文字列=既定も許容)", () => {
    expect(mergeSettings({ editorFontFamily: "Consolas" }).editorFontFamily).toBe("Consolas");
    expect(mergeSettings({ previewFontFamily: "" }).previewFontFamily).toBe("");
  });

  it("フォントファミリの前後の空白は取り除く", () => {
    expect(mergeSettings({ editorFontFamily: "  BIZ UDGothic " }).editorFontFamily).toBe(
      "BIZ UDGothic",
    );
  });

  it("フォントファミリが文字列でない場合はデフォルト(空)にフォールバックする", () => {
    expect(mergeSettings({ editorFontFamily: 42 }).editorFontFamily).toBe("");
    expect(mergeSettings({ previewFontFamily: ["Meiryo"] }).previewFontFamily).toBe("");
  });

  it("フォントファミリが長すぎる(200文字超)場合はデフォルトにフォールバックする", () => {
    expect(mergeSettings({ editorFontFamily: "あ".repeat(201) }).editorFontFamily).toBe("");
    expect(mergeSettings({ previewFontFamily: "a".repeat(200) }).previewFontFamily).toBe(
      "a".repeat(200),
    );
  });
});
