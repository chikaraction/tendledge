import { describe, expect, it } from "vitest";
import { basename, suggestedExportName } from "./paths";

describe("basename: パスからファイル名を取り出す", () => {
  it("Windows 形式のパス(バックスラッシュ区切り)からファイル名を返す", () => {
    expect(basename("C:\\docs\\memo.adoc")).toBe("memo.adoc");
  });

  it("POSIX 形式のパス(スラッシュ区切り)からファイル名を返す", () => {
    expect(basename("/home/user/memo.adoc")).toBe("memo.adoc");
  });

  it("区切りが混在していても最後の要素を返す", () => {
    expect(basename("C:\\docs/notes\\memo.adoc")).toBe("memo.adoc");
  });

  it("区切りを含まない文字列はそのまま返す", () => {
    expect(basename("memo.adoc")).toBe("memo.adoc");
  });

  it("【特性化】末尾が区切りの場合はパス全体にフォールバックする", () => {
    // 最後の要素が空文字になるため `|| path` が効く、という現在の実装の挙動。
    expect(basename("C:\\docs\\")).toBe("C:\\docs\\");
  });
});

describe("suggestedExportName: エクスポート時の既定ファイル名", () => {
  it("ファイルパスがなければ untitled.<拡張子> を返す", () => {
    expect(suggestedExportName(undefined, "html")).toBe("untitled.html");
  });

  it("元ファイルの拡張子を指定の拡張子に差し替える", () => {
    expect(suggestedExportName("C:\\docs\\memo.adoc", "html")).toBe("memo.html");
  });

  it("拡張子のないファイル名にはそのまま拡張子を付ける", () => {
    expect(suggestedExportName("/home/user/notes", "pdf")).toBe("notes.pdf");
  });

  it("ドットを複数含む名前は最後の拡張子だけを差し替える", () => {
    expect(suggestedExportName("a.b.adoc", "html")).toBe("a.b.html");
  });
});
