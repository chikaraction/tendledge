// AsciiDoc ソースから見出し行を抽出する(純粋関数)

/**
 * 見出し(`=` の連なり + 空白で始まる行)の行番号を出現順で返す。
 * 行番号は 1 始まり(CodeMirror の行番号と揃える)。
 */
export function extractHeadingLines(source: string): number[] {
  const headingLines: number[] = [];
  source.split("\n").forEach((line, i) => {
    if (/^=+\s/.test(line)) headingLines.push(i + 1);
  });
  return headingLines;
}
