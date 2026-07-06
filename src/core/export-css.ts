// styles.css(アプリ全体のスタイルシート)から、スタンドアロン HTML エクスポート用に
// 必要なルールだけを抜き出す純粋関数。
//
// 抜き出す対象は「:root(ライトのデフォルト変数)」と「.adoc を含むセレクタのルール」のみで、
// @media ブロック(ダークモード自動追従・印刷専用の上書きなど)はまるごと除外する。
// これによりエクスポート結果は常にライト固定になり、読み手の OS 設定や
// :root[data-theme="dark"](エクスポート先には存在しない属性なのでどのみち発火しないが、
// 念のため)の影響を受けない。

/** css のうち i 番目の "{" に対応する "}" の直後の位置を返す(ネストなし前提) */
function findRuleEnd(css: string, braceStart: number): number {
  const close = css.indexOf("}", braceStart);
  return close === -1 ? css.length : close + 1;
}

/** css のうち i 番目の "{" に対応する "}"(ネストあり)の直後の位置を返す(@media 用) */
function findBlockEnd(css: string, braceStart: number): number {
  let depth = 1;
  let i = braceStart + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  return i;
}

export function extractLightAdocCss(css: string): string {
  const rules: string[] = [];
  let i = 0;
  const n = css.length;

  while (i < n) {
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (/\s/.test(css[i])) {
      i++;
      continue;
    }
    if (css[i] === "@") {
      // @media 等の at-rule はネストしたブロックごと丸ごと読み飛ばす
      const braceStart = css.indexOf("{", i);
      if (braceStart === -1) break;
      i = findBlockEnd(css, braceStart);
      continue;
    }
    const braceStart = css.indexOf("{", i);
    if (braceStart === -1) break;
    const selector = css.slice(i, braceStart).trim();
    const ruleEnd = findRuleEnd(css, braceStart);
    if (selector === ":root" || selector.includes(".adoc")) {
      rules.push(`${selector} ${css.slice(braceStart, ruleEnd)}`);
    }
    i = ruleEnd;
  }

  return rules.join("\n");
}
