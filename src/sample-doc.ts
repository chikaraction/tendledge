// 初回起動時に表示するサンプル文書
export const sampleDoc = `= はじめての AsciiDoc
:author: あなたの名前

== これは何?

*AsciiDoc* のリアルタイムプレビュー付きエディタです。
左側を編集すると、右側に _すぐ_ 反映されます。

== 使える記法の例

* 箇条書き
* \`モノスペース\` や *太字*
** ネストもできる

. 番号付きリスト
. 二番目

[source,javascript]
----
// コードブロック
const greet = (name) => \`Hello, \${name}!\`;
----

NOTE: アドモニション(注記ブロック)も使えます。

TIP: 表やリンクなど、AsciiDoc の全機能が Asciidoctor.js で変換されます。

|===
| 列 A | 列 B

| セル 1
| セル 2
|===
`;
