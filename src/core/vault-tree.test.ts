import { describe, expect, it } from "vitest";
import { buildVaultTree, isSupportedFile, type RawEntry } from "./vault-tree";

// readDir の結果(名前 + 種別 + 子)からサイドバーに表示するツリーを作る。
// 対応拡張子のファイルだけを表示し、空になるフォルダは隠す。

describe("isSupportedFile: エディタで扱うファイルかどうか", () => {
  it.each(["memo.adoc", "memo.asciidoc", "memo.asc", "memo.txt"])("%s は対象", (name) => {
    expect(isSupportedFile(name)).toBe(true);
  });

  it.each(["image.png", "script.js", "no-extension"])("%s は対象外", (name) => {
    expect(isSupportedFile(name)).toBe(false);
  });

  it("拡張子は大文字小文字を区別しない", () => {
    expect(isSupportedFile("MEMO.ADOC")).toBe(true);
  });
});

describe("buildVaultTree: readDir 結果 → 表示ツリー", () => {
  const root = "C:\\vault";

  it("対応ファイルだけを含むフラットなツリーを作り、各ノードにフルパスを付ける", () => {
    const entries: RawEntry[] = [
      { name: "b.adoc", isDirectory: false },
      { name: "image.png", isDirectory: false },
    ];
    const tree = buildVaultTree(root, entries);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ name: "b.adoc", kind: "file", path: "C:\\vault\\b.adoc" });
  });

  it("フォルダはネストされ、子のパスは親を継承する", () => {
    const entries: RawEntry[] = [
      {
        name: "notes",
        isDirectory: true,
        children: [{ name: "a.adoc", isDirectory: false }],
      },
    ];
    const tree = buildVaultTree(root, entries);
    expect(tree[0].kind).toBe("dir");
    expect(tree[0].children![0].path).toBe("C:\\vault\\notes\\a.adoc");
  });

  it("対応ファイルを 1 つも含まないフォルダは表示しない", () => {
    const entries: RawEntry[] = [
      {
        name: "images",
        isDirectory: true,
        children: [{ name: "photo.png", isDirectory: false }],
      },
      { name: "a.adoc", isDirectory: false },
    ];
    const tree = buildVaultTree(root, entries);
    expect(tree.map((n) => n.name)).toEqual(["a.adoc"]);
  });

  it("深くネストした対応ファイルがあればフォルダの階層ごと残る", () => {
    const entries: RawEntry[] = [
      {
        name: "a",
        isDirectory: true,
        children: [
          {
            name: "b",
            isDirectory: true,
            children: [{ name: "deep.adoc", isDirectory: false }],
          },
        ],
      },
    ];
    const tree = buildVaultTree(root, entries);
    expect(tree[0].children![0].children![0].name).toBe("deep.adoc");
  });

  it("ドットで始まるエントリ(.git 等)は無視する", () => {
    const entries: RawEntry[] = [
      { name: ".git", isDirectory: true, children: [{ name: "config.txt", isDirectory: false }] },
      { name: ".hidden.adoc", isDirectory: false },
      { name: "a.adoc", isDirectory: false },
    ];
    expect(buildVaultTree(root, entries).map((n) => n.name)).toEqual(["a.adoc"]);
  });

  it("フォルダが先、その中では名前順(大文字小文字の区別なし)に並ぶ", () => {
    const entries: RawEntry[] = [
      { name: "z.adoc", isDirectory: false },
      { name: "A.adoc", isDirectory: false },
      { name: "sub", isDirectory: true, children: [{ name: "x.adoc", isDirectory: false }] },
      { name: "b.adoc", isDirectory: false },
    ];
    const tree = buildVaultTree(root, entries);
    expect(tree.map((n) => n.name)).toEqual(["sub", "A.adoc", "b.adoc", "z.adoc"]);
  });

  it("ルートのパスが / 区切りなら子のパスも / で結合する", () => {
    const entries: RawEntry[] = [{ name: "a.adoc", isDirectory: false }];
    const tree = buildVaultTree("/home/user/vault", entries);
    expect(tree[0].path).toBe("/home/user/vault/a.adoc");
  });
});
