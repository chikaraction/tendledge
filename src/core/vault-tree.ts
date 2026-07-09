// 保管庫のファイルツリーモデル(純粋ロジック)
//
// readDir の走査結果(RawEntry)から、サイドバーに表示するツリー(VaultNode)を作る。
// 実際のディレクトリ走査(Tauri API)は ui / main 側の責務。

/** readDir の結果をアプリ内で持ち回るための最小形 */
export interface RawEntry {
  name: string;
  isDirectory: boolean;
  children?: RawEntry[];
}

export interface VaultNode {
  name: string;
  /** フルパス(ルートパスの区切り文字を継承して結合される) */
  path: string;
  kind: "dir" | "file";
  children?: VaultNode[];
}

export const SUPPORTED_EXTENSIONS = ["adoc", "asciidoc", "asc", "txt"];

/** エディタで開ける拡張子か(大文字小文字は区別しない) */
export function isSupportedFile(name: string): boolean {
  const match = /\.([^.]+)$/.exec(name);
  if (!match) return false;
  return SUPPORTED_EXTENSIONS.includes(match[1].toLowerCase());
}

/**
 * 表示ツリーを構築する。
 * - 対応拡張子のファイルだけを含める
 * - 対応ファイルを 1 つも含まない(=空になる)フォルダは隠す
 * - ドットで始まるエントリ(.git 等)は無視する
 * - 並び順: フォルダが先、その中では名前順(大文字小文字の区別なし)
 */
export function buildVaultTree(rootPath: string, entries: RawEntry[]): VaultNode[] {
  const sep = rootPath.includes("\\") ? "\\" : "/";

  function build(parentPath: string, entry: RawEntry): VaultNode | undefined {
    if (entry.name.startsWith(".")) return undefined;
    const path = `${parentPath}${sep}${entry.name}`;
    if (entry.isDirectory) {
      const children = buildAll(path, entry.children ?? []);
      if (children.length === 0) return undefined; // 空になるフォルダは表示しない
      return { name: entry.name, path, kind: "dir", children };
    }
    if (!isSupportedFile(entry.name)) return undefined;
    return { name: entry.name, path, kind: "file" };
  }

  function buildAll(parentPath: string, list: RawEntry[]): VaultNode[] {
    return list
      .map((e) => build(parentPath, e))
      .filter((n): n is VaultNode => n !== undefined)
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }

  return buildAll(rootPath, entries);
}

/** ツリー内の対応ファイルの総数を数える(フォルダ自体は数えない) */
export function countFiles(tree: VaultNode[]): number {
  return tree.reduce(
    (sum, node) => sum + (node.kind === "file" ? 1 : countFiles(node.children ?? [])),
    0,
  );
}
