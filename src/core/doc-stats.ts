// ステータスバーに表示する文書統計(純粋関数。DOM / CodeMirror に依存しない)

/**
 * 表示用の文字数。改行(LF / CR)は含めず、
 * サロゲートペア(絵文字など)は 1 文字と数える。
 */
export function countCharacters(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch !== "\n" && ch !== "\r") count++;
  }
  return count;
}

/** 3桁区切り + 「文字」付きの表示文字列にする。 */
export function formatCharCount(count: number): string {
  return `${count.toLocaleString("en-US")} 文字`;
}
