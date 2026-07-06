import type { StreamParser } from "@codemirror/language";

// ---------------------------------------------------------------------------
// 簡易 AsciiDoc ハイライト(マイルストーン4: テーブル内部 / インラインマクロ / ネスト対応)
//
// AsciiDoc は行頭記号で構造が決まる構文が多いため、
// StreamParser でもかなりの部分をカバーできる。
// 返すトークン名は @lezer/highlight の標準タグ名に解決される。
// ---------------------------------------------------------------------------

interface BlockFrame {
  // 開始行にマッチした区切り文字列(前後の空白は除く)。
  // 閉じ行はこれと完全一致した場合のみブロックを抜ける。
  delim: string;
  // true の間は内容を丸ごとモノスペースとして扱う(コード/リテラルブロック)。
  monospace: boolean;
}

interface State {
  blockStack: BlockFrame[];
}

// ブロック区切り行の定義。ネストは「開始区切り文字列と完全一致する行でしか
// 閉じない」というルールでスタックにより表現する(例: ==== の中に **** を
// 置いても正しく対応が取れる)。
const BLOCK_DELIMITERS: { re: RegExp; monospace: boolean }[] = [
  { re: /^-{4,}\s*$/, monospace: true }, // リスティングブロック(コードブロック)
  { re: /^\.{4,}\s*$/, monospace: true }, // リテラルブロック
  { re: /^={4,}\s*$/, monospace: false }, // 例示ブロック
  { re: /^\*{4,}\s*$/, monospace: false }, // サイドバー
  { re: /^_{4,}\s*$/, monospace: false }, // 引用ブロック
  { re: /^--\s*$/, monospace: false }, // オープンブロック
  { re: /^\|={3,}\s*$/, monospace: false }, // 表
];

// 表セルの区切り。列/行結合(2+| / .2+| / 2.2+|)、配置(<.^|)、
// セルスタイル(a|)などの接頭辞をまとめて「セル区切り」として1トークンにする。
const TABLE_CELL = /^(?:(?:\d+(?:\.\d+)?|\.\d+)[+*])?(?:[<^>](?:\.[<^>])?)?[adehlms]?\|/;

export const asciidocMode: StreamParser<State> = {
  name: "asciidoc",

  startState(): State {
    return { blockStack: [] };
  },

  token(stream, state): string | null {
    const top = state.blockStack[state.blockStack.length - 1];

    if (stream.sol()) {
      // --- モノスペースブロック内(コード/リテラル) -----------------------
      if (top?.monospace) {
        const rest = stream.string.slice(stream.pos);
        if (rest.trim() === top.delim) {
          stream.skipToEnd();
          state.blockStack.pop();
          return "meta";
        }
        stream.skipToEnd();
        return "monospace";
      }

      // --- ブロック区切り行(開始 / 終了、ネスト対応) ----------------------
      for (const { re, monospace } of BLOCK_DELIMITERS) {
        const m = stream.match(re);
        if (m) {
          const delimText = (Array.isArray(m) ? m[0] : stream.current()).trim();
          if (top && top.delim === delimText) {
            state.blockStack.pop();
          } else {
            state.blockStack.push({ delim: delimText, monospace });
          }
          return "meta";
        }
      }

      // 見出し: = タイトル / == セクション ...
      if (stream.match(/^=+\s/)) {
        stream.skipToEnd();
        return "heading";
      }
      // コメント行: //
      if (stream.match(/^\/\/.*$/)) {
        return "comment";
      }
      // 属性エントリ: :name: value
      if (stream.match(/^:[!\w-]+:.*$/)) {
        return "meta";
      }
      // ブロック属性: [source,js] など
      if (stream.match(/^\[.*\]\s*$/)) {
        return "meta";
      }
      // アドモニション: NOTE: TIP: など
      if (stream.match(/^(NOTE|TIP|IMPORTANT|WARNING|CAUTION):/)) {
        return "keyword";
      }
      // リストマーカー: * ** - . ..
      if (stream.match(/^(\*+|-|\.+)\s/)) {
        return "atom";
      }
    }

    // --- 表のセル区切り(行頭・行内どちらでも) -----------------------------
    if (stream.match(TABLE_CELL)) return "punctuation";

    // --- インライン記法 ---------------------------------------------------
    if (stream.match(/^`[^`\n]+`/)) return "monospace";
    if (stream.match(/^\*[^*\n]+\*/)) return "strong";
    if (stream.match(/^_[^_\n]+_/)) return "emphasis";
    // 相互参照: <<id>> / <<id,text>>
    if (stream.match(/^<<[^>\n]+>>/)) return "link";
    // インラインアンカー: [[id]]
    if (stream.match(/^\[\[[\w-]+\]\]/)) return "meta";
    // 属性参照: {name}
    if (stream.match(/^\{[\w-]+\}/)) return "meta";
    // インラインマクロ: image::...[], link:...[], xref:...[], footnote:[...] など
    if (stream.match(/^\w+::?[^\s[]*\[[^\]]*\]/)) return "link";
    if (stream.match(/^https?:\/\/\S+/)) return "link";

    stream.next();
    return null;
  },
};
