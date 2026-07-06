// パス文字列の操作(純粋関数。DOM / Tauri に依存しない)

/** パスの最後の要素(ファイル名)を返す。区切りは / と \ の両方に対応。 */
export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** 親パスの区切り文字(\ か /)を継承して子の名前を結合する。 */
export function joinPath(parent: string, name: string): string {
  const sep = parent.includes("\\") ? "\\" : "/";
  const trimmed = parent.endsWith(sep) ? parent.slice(0, -1) : parent;
  return `${trimmed}${sep}${name}`;
}

/** 親ディレクトリのパスを返す。区切りを含まなければ空文字。 */
export function dirname(path: string): string {
  const match = /^(.*)[\\/][^\\/]*$/.exec(path);
  return match ? match[1] : "";
}

/**
 * 基準ディレクトリから相対パス(./ ../ 含む)を解決する。
 * 相対パス側の区切りは / でも \ でもよく、結果は基準側の区切り文字に揃える。
 */
export function resolvePath(baseDir: string, relative: string): string {
  const sep = baseDir.includes("\\") ? "\\" : "/";
  const root = /^[\\/]/.test(baseDir) ? sep : "";
  const stack = baseDir.split(/[\\/]/).filter((p) => p !== "");
  for (const part of relative.split(/[\\/]/)) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return root + stack.join(sep);
}

/** エクスポート時の既定ファイル名。元ファイルの拡張子を差し替える。 */
export function suggestedExportName(path: string | undefined, ext: string): string {
  if (!path) return `untitled.${ext}`;
  const base = basename(path).replace(/\.[^.]+$/, "");
  return `${base}.${ext}`;
}
