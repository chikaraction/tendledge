// パス文字列の操作(純粋関数。DOM / Tauri に依存しない)

/** パスの最後の要素(ファイル名)を返す。区切りは / と \ の両方に対応。 */
export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** エクスポート時の既定ファイル名。元ファイルの拡張子を差し替える。 */
export function suggestedExportName(path: string | undefined, ext: string): string {
  if (!path) return `untitled.${ext}`;
  const base = basename(path).replace(/\.[^.]+$/, "");
  return `${base}.${ext}`;
}
