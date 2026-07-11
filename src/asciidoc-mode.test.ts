// asciidoc-mode.ts のキャラクタリゼーションテスト。
//
// 手書き StreamParser(blockStack によるネストブロック解決)の
// 「現在の挙動」を仕様として固定する。実装(asciidoc-mode.ts 本体)は
// 一切変更しない。テストの期待値が実際の挙動と食い違ったら直すのはテスト側。
//
// トークンは行単位で [トークン名, テキスト] の列として得る。
// StringStream は @codemirror/language の公開クラスを使う(index.d.ts で export 確認済み)。
import { StringStream } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { asciidocMode } from "./asciidoc-mode";

type Span = [string | null, string];

// 文書全体を行単位でトークナイズし、行ごとの [トークン名, テキスト] 列を返す。
// state は文書全体で共有する(blockStack がまたがるネスト判定を再現するため)。
function tokenize(doc: string): Span[][] {
  const state = asciidocMode.startState!(2);
  return doc.split("\n").map((line) => {
    const spans: Span[] = [];
    if (line === "") return spans; // CodeMirror は空行で token() を呼ばない
    const stream = new StringStream(line, 4, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      const tok = asciidocMode.token(stream, state);
      spans.push([tok, stream.current()]);
    }
    return spans;
  });
}

// 1行だけをトークナイズする(単発の行頭構文・インライン記法の確認用)。
function tokenizeLine(line: string): Span[] {
  return tokenize(line)[0];
}

describe("asciidocMode: 行頭構文", () => {
  it("見出し(=) は行全体が heading になる", () => {
    expect(tokenizeLine("= タイトル")).toEqual([["heading", "= タイトル"]]);
  });

  it("見出し(==) も行全体が heading になる", () => {
    expect(tokenizeLine("== セクション")).toEqual([["heading", "== セクション"]]);
  });

  it("コメント行(//)は行全体が comment になる", () => {
    expect(tokenizeLine("// これはコメント")).toEqual([["comment", "// これはコメント"]]);
  });

  it("属性エントリ(:name: value)は行全体が meta になる", () => {
    expect(tokenizeLine(":author: 山田太郎")).toEqual([["meta", ":author: 山田太郎"]]);
  });

  it("ブロック属性([source,js])は行全体が meta になる", () => {
    expect(tokenizeLine("[source,js]")).toEqual([["meta", "[source,js]"]]);
  });

  it("アドモニション(NOTE:)は行頭の 'NOTE:' だけが keyword になる", () => {
    const spans = tokenizeLine("NOTE: 注意書き");
    expect(spans[0]).toEqual(["keyword", "NOTE:"]);
    // NOTE: の後ろはアドモニション処理の対象外(地の文として個別にトークナイズされる)
    expect(spans.slice(1).every(([tok]) => tok === null)).toBe(true);
  });

  it("アドモニション(TIP:)も行頭だけ keyword になる", () => {
    expect(tokenizeLine("TIP: ヒント")[0]).toEqual(["keyword", "TIP:"]);
  });

  it("リストマーカー(* )はマーカー+空白だけが atom になる", () => {
    const spans = tokenizeLine("* 項目1");
    expect(spans[0]).toEqual(["atom", "* "]);
  });

  it("リストマーカー(** )も atom になる(ネストしたリスト)", () => {
    expect(tokenizeLine("** 項目1-1")[0]).toEqual(["atom", "** "]);
  });

  it("リストマーカー(- )も atom になる", () => {
    expect(tokenizeLine("- 項目")[0]).toEqual(["atom", "- "]);
  });

  it("番号付きリストマーカー(. )も atom になる", () => {
    expect(tokenizeLine(". 項目")[0]).toEqual(["atom", ". "]);
  });

  it("番号付きリストマーカー(.. )も atom になる", () => {
    expect(tokenizeLine(".. 項目")[0]).toEqual(["atom", ".. "]);
  });
});

describe("asciidocMode: 区切りブロック(blockStack)", () => {
  it("リスティングブロック(----)は区切り行が meta、内部は行全体が monospace", () => {
    const lines = tokenize(["----", "console.log('hi');", "= 見出し風の文字列", "----"].join("\n"));
    expect(lines[0]).toEqual([["meta", "----"]]);
    expect(lines[1]).toEqual([["monospace", "console.log('hi');"]]);
    // ブロック内では見出し記法が効かず、行全体が monospace のまま
    expect(lines[2]).toEqual([["monospace", "= 見出し風の文字列"]]);
    expect(lines[3]).toEqual([["meta", "----"]]);
  });

  it("リテラルブロック(....)も区切りが meta、内部が monospace", () => {
    const lines = tokenize(["....", "raw text", "...."].join("\n"));
    expect(lines[0]).toEqual([["meta", "...."]]);
    expect(lines[1]).toEqual([["monospace", "raw text"]]);
    expect(lines[2]).toEqual([["meta", "...."]]);
  });

  it("例示ブロック(====)は区切りが meta、内部では見出し記法が引き続き効く", () => {
    const lines = tokenize(["====", "= 見出し", "===="].join("\n"));
    expect(lines[0]).toEqual([["meta", "===="]]);
    expect(lines[1]).toEqual([["heading", "= 見出し"]]);
    expect(lines[2]).toEqual([["meta", "===="]]);
  });

  it("サイドバー(****)も区切りが meta、内部で強調記法が効く", () => {
    const lines = tokenize(["****", "*strong*", "****"].join("\n"));
    expect(lines[0]).toEqual([["meta", "****"]]);
    expect(lines[1]).toEqual([["strong", "*strong*"]]);
    expect(lines[2]).toEqual([["meta", "****"]]);
  });

  it("引用ブロック(____)も区切りが meta、内部で強調記法が効く", () => {
    const lines = tokenize(["____", "_em_", "____"].join("\n"));
    expect(lines[0]).toEqual([["meta", "____"]]);
    expect(lines[1]).toEqual([["emphasis", "_em_"]]);
    expect(lines[2]).toEqual([["meta", "____"]]);
  });

  it("オープンブロック(--)も区切りが meta、内部で見出し記法が効く", () => {
    const lines = tokenize(["--", "= 見出し", "--"].join("\n"));
    expect(lines[0]).toEqual([["meta", "--"]]);
    expect(lines[1]).toEqual([["heading", "= 見出し"]]);
    expect(lines[2]).toEqual([["meta", "--"]]);
  });

  it("ネスト: ==== の中の **** が正しく開閉し、外側の ==== も自分の区切りで閉じる", () => {
    const doc = ["====", "外側テキスト", "****", "内側テキスト", "****", "外側テキスト2", "===="].join(
      "\n",
    );
    const lines = tokenize(doc);
    expect(lines[0]).toEqual([["meta", "===="]]); // 外側開く
    expect(lines[2]).toEqual([["meta", "****"]]); // 内側開く
    expect(lines[4]).toEqual([["meta", "****"]]); // 内側閉じる
    expect(lines[6]).toEqual([["meta", "===="]]); // 外側閉じる
  });

  it("完全一致で閉じる: -----(5個)で開けたブロックは ----(4個)では閉じない", () => {
    const doc = ["-----", "----", "code", "-----"].join("\n");
    const lines = tokenize(doc);
    expect(lines[0]).toEqual([["meta", "-----"]]); // 5個で開く
    // 4個の行は閉じる区切りとして一致しないので、モノスペース内部の地の文として扱われる
    expect(lines[1]).toEqual([["monospace", "----"]]);
    expect(lines[2]).toEqual([["monospace", "code"]]);
    expect(lines[3]).toEqual([["meta", "-----"]]); // 5個で閉じる
  });

  it("閉じた後は通常モードに戻る(見出しが再び heading になる)", () => {
    const doc = ["----", "code", "----", "= 通常の見出し"].join("\n");
    const lines = tokenize(doc);
    expect(lines[3]).toEqual([["heading", "= 通常の見出し"]]);
  });
});

describe("asciidocMode: 表", () => {
  it("表の開始・終了(|===)は meta になる", () => {
    const lines = tokenize(["|===", "|a |b", "|==="].join("\n"));
    expect(lines[0]).toEqual([["meta", "|==="]]);
    expect(lines[2]).toEqual([["meta", "|==="]]);
  });

  it("セル区切り(単独の |)は punctuation になる", () => {
    const spans = tokenizeLine("|セル内容");
    expect(spans[0]).toEqual(["punctuation", "|"]);
  });

  it("列結合(2+|)は punctuation 1トークンになる", () => {
    const spans = tokenizeLine("2+|結合セル");
    expect(spans[0]).toEqual(["punctuation", "2+|"]);
  });

  it("行結合(.2+|)は punctuation 1トークンになる", () => {
    const spans = tokenizeLine(".2+|結合セル");
    expect(spans[0]).toEqual(["punctuation", ".2+|"]);
  });

  it("複合結合(2.2+|)は punctuation 1トークンになる", () => {
    const spans = tokenizeLine("2.2+|結合セル");
    expect(spans[0]).toEqual(["punctuation", "2.2+|"]);
  });

  it("配置指定(<| ^|)は punctuation 1トークンになる", () => {
    expect(tokenizeLine("<|左揃え")[0]).toEqual(["punctuation", "<|"]);
    expect(tokenizeLine("^|中央揃え")[0]).toEqual(["punctuation", "^|"]);
  });

  it("配置+垂直指定(<.^|)は punctuation 1トークンになる", () => {
    expect(tokenizeLine("<.^|セル")[0]).toEqual(["punctuation", "<.^|"]);
  });

  it("セルスタイル(a|)は punctuation 1トークンになる", () => {
    expect(tokenizeLine("a|AsciiDoc セル")[0]).toEqual(["punctuation", "a|"]);
  });

  it("行内(行頭以外)のセル区切りも punctuation になる", () => {
    const spans = tokenizeLine("|a |b");
    const punctSpans = spans.filter(([tok]) => tok === "punctuation");
    expect(punctSpans.map(([, text]) => text)).toEqual(["|", "|"]);
  });
});

describe("asciidocMode: インライン記法", () => {
  it("等幅(`code`)は monospace になる", () => {
    const spans = tokenizeLine("地の文 `code` の続き");
    expect(spans.find(([tok]) => tok === "monospace")).toEqual(["monospace", "`code`"]);
  });

  it("強調(*strong*)は strong になる", () => {
    const spans = tokenizeLine("地の文 *strong* の続き");
    expect(spans.find(([tok]) => tok === "strong")).toEqual(["strong", "*strong*"]);
  });

  it("斜体(_em_)は emphasis になる", () => {
    const spans = tokenizeLine("地の文 _em_ の続き");
    expect(spans.find(([tok]) => tok === "emphasis")).toEqual(["emphasis", "_em_"]);
  });

  it("相互参照(<<id>>)は link になる", () => {
    const spans = tokenizeLine("参照: <<section-1>>");
    expect(spans.find(([tok]) => tok === "link")).toEqual(["link", "<<section-1>>"]);
  });

  it("相互参照(<<id,text>>)も link になる", () => {
    const spans = tokenizeLine("参照: <<section-1,セクション1>>");
    expect(spans.find(([tok]) => tok === "link")).toEqual(["link", "<<section-1,セクション1>>"]);
  });

  it("インラインアンカー([[id]])は meta になる", () => {
    const spans = tokenizeLine("文中の [[anchor-1]] アンカー");
    expect(spans.find(([tok]) => tok === "meta")).toEqual(["meta", "[[anchor-1]]"]);
  });

  it("属性参照({name})は meta になる", () => {
    const spans = tokenizeLine("バージョン: {version}");
    expect(spans.find(([tok]) => tok === "meta")).toEqual(["meta", "{version}"]);
  });

  it("画像マクロ(image::a.png[alt])は link になる", () => {
    const spans = tokenizeLine("image::a.png[alt]");
    expect(spans.find(([tok]) => tok === "link")).toEqual(["link", "image::a.png[alt]"]);
  });

  it("リンクマクロ(link:url[text])は link になる", () => {
    const spans = tokenizeLine("link:https://example.com[text]");
    expect(spans.find(([tok]) => tok === "link")).toEqual([
      "link",
      "link:https://example.com[text]",
    ]);
  });

  it("脚注マクロ(footnote:[text])は link になる", () => {
    const spans = tokenizeLine("footnote:[補足説明]");
    expect(spans.find(([tok]) => tok === "link")).toEqual(["link", "footnote:[補足説明]"]);
  });

  it("素の URL は link になる", () => {
    const spans = tokenizeLine("参照先: https://example.com/path");
    expect(spans.find(([tok]) => tok === "link")).toEqual(["link", "https://example.com/path"]);
  });

  it("記法にマッチしない地の文は null になる", () => {
    const spans = tokenizeLine("ただの日本語の文章です");
    expect(spans.every(([tok]) => tok === null)).toBe(true);
  });
});
