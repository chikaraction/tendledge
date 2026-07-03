import type { StreamParser } from "@codemirror/language";

// ---------------------------------------------------------------------------
// 簡易 AsciiDoc ハイライト(ステップ4の足がかり)
//
// AsciiDoc は行頭記号で構造が決まる構文が多いため、
// StreamParser でもかなりの部分をカバーできる。
// 返すトークン名は @lezer/highlight の標準タグ名に解決される。
// ---------------------------------------------------------------------------

interface State {
  inCodeBlock: boolean;
}

export const asciidocMode: StreamParser<State> = {
  name: "asciidoc",

  startState(): State {
    return { inCodeBlock: false };
  },

  token(stream, state): string | null {
    // --- コードブロック内 -------------------------------------------------
    if (state.inCodeBlock) {
      if (stream.sol() && stream.match(/^----\s*$/)) {
        state.inCodeBlock = false;
        return "meta";
      }
      stream.skipToEnd();
      return "monospace";
    }

    if (stream.sol()) {
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
      // コードブロック開始
      if (stream.match(/^----\s*$/)) {
        state.inCodeBlock = true;
        return "meta";
      }
      // その他のブロック区切り: ==== **** ____ ....
      if (stream.match(/^(={4,}|\*{4,}|_{4,}|\.{4,}|\|===)\s*$/)) {
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
      // 表のセル区切り
      if (stream.match(/^\|/)) {
        return "punctuation";
      }
    }

    // --- インライン記法 ---------------------------------------------------
    if (stream.match(/^`[^`\n]+`/)) return "monospace";
    if (stream.match(/^\*[^*\n]+\*/)) return "strong";
    if (stream.match(/^_[^_\n]+_/)) return "emphasis";
    // インラインマクロ: image::...[], link:...[], https://...[]
    if (stream.match(/^\w+::?[^\s[]*\[[^\]]*\]/)) return "link";
    if (stream.match(/^https?:\/\/\S+/)) return "link";

    stream.next();
    return null;
  },
};
