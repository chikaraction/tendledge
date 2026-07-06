import { describe, expect, it } from "vitest";
import { basename, dirname, joinPath, resolvePath, suggestedExportName } from "./paths";

describe("joinPath: 親パスの区切り文字を継承して結合する", () => {
  it("バックスラッシュ区切りの親にはバックスラッシュで結合する", () => {
    expect(joinPath("C:\\vault", "memo.adoc")).toBe("C:\\vault\\memo.adoc");
  });

  it("スラッシュ区切りの親にはスラッシュで結合する", () => {
    expect(joinPath("/home/user/vault", "memo.adoc")).toBe("/home/user/vault/memo.adoc");
  });

  it("親の末尾に区切り文字があっても二重にならない", () => {
    expect(joinPath("C:\\vault\\", "memo.adoc")).toBe("C:\\vault\\memo.adoc");
  });
});

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

describe("dirname: パスから親ディレクトリを取り出す", () => {
  it("Windows 形式のパスから親ディレクトリを返す", () => {
    expect(dirname("C:\\docs\\memo.adoc")).toBe("C:\\docs");
  });

  it("POSIX 形式のパスから親ディレクトリを返す", () => {
    expect(dirname("/home/user/memo.adoc")).toBe("/home/user");
  });

  it("区切りを含まない文字列には空文字を返す", () => {
    expect(dirname("memo.adoc")).toBe("");
  });
});

describe("resolvePath: 基準ディレクトリから相対パスを解決する", () => {
  it("同じディレクトリのファイルを解決する", () => {
    expect(resolvePath("C:\\vault\\sample", "02-lists.adoc")).toBe(
      "C:\\vault\\sample\\02-lists.adoc",
    );
  });

  it("./ 始まりの相対パスを解決する", () => {
    expect(resolvePath("C:\\vault\\sample", "./02-lists.adoc")).toBe(
      "C:\\vault\\sample\\02-lists.adoc",
    );
  });

  it("../ で親ディレクトリに上がれる", () => {
    expect(resolvePath("C:\\vault\\sample", "../notes/memo.adoc")).toBe(
      "C:\\vault\\notes\\memo.adoc",
    );
  });

  it("サブディレクトリへ下がれる", () => {
    expect(resolvePath("/home/user/vault", "sub/memo.adoc")).toBe("/home/user/vault/sub/memo.adoc");
  });

  it("POSIX の絶対パス基準でルートの / を失わない", () => {
    expect(resolvePath("/home/user", "../memo.adoc")).toBe("/home/memo.adoc");
  });

  it("基準がバックスラッシュ区切りなら結果もバックスラッシュ区切りになる(リンクは / で書かれるため)", () => {
    expect(resolvePath("C:\\vault", "sub/memo.adoc")).toBe("C:\\vault\\sub\\memo.adoc");
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
