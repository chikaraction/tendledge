// F1 で開く組み込みヘルプ文書(core/documents.ts の openHelp でタブとして開く)
export const helpDoc = `= Tendledge ヘルプ
:author: Tendledge
:toc:
:toc-title: 目次
:toclevels: 3

== ショートカット一覧

=== ファイル・タブ

[cols="1,2"]
|===
| ショートカット | 動作

| Ctrl+N
| 新規タブ

| Ctrl+O
| ファイルを開く

| Ctrl+S
| 保存

| Ctrl+Shift+S
| 名前を付けて保存

| Ctrl+P
| PDF / 印刷

| Ctrl+W
| タブを閉じる(未保存の変更があれば確認ダイアログが出ます)

| Ctrl+Tab
| 次のタブへ切り替え

| Ctrl+K に続けて V
| 分割表示(エディタ + プレビュー)。Ctrl+K の後 1.5 秒以内に V を押してください

| Ctrl+Shift+V
| プレビューのみ表示

| Ctrl+F
| 検索(エディタ表示中はエディタの検索パネル。プレビューのみ表示中は
  ブラウザ/WebView のネイティブ検索になります)

| F1
| 本ヘルプを開く
|===

=== エディタ操作(CodeMirror の basicSetup 由来)

* Ctrl+Z / Ctrl+Y: 元に戻す / やり直す
* Tab / Shift+Tab: インデント / インデント解除
* 検索パネル内では置換(1件ずつ・全置換)も行えます

== AsciiDoc 対応状況

* \`include::\` ディレクティブは未対応です(アプリ内蔵の Asciidoctor.js が
  変換中にローカルファイルを読み込めないためです。対応は今後の検討事項です)
* 文書間リンクは \`xref:\` を推奨します。\`link:*.adoc[...]\` は HTML / PDF
  エクスポート後も \`.adoc\` のパスのまま残ってしまいます
* パススルーブロック(\`++++\`)はプレビューではサニタイズ(DOMPurify)されますが、
  HTML エクスポートではサニタイズされずそのまま出力されます。挙動が異なる点に
  注意してください

== 図

Mermaid はビルトインで、PlantUML と Draw.io は Kroki サーバー経由で描画します。

=== Mermaid(ビルトイン)

[source,asciidoc]
----
[mermaid]
....
graph TD
  A[開始] --> B[終了]
....
----

=== PlantUML(Kroki 経由)

[source,asciidoc]
----
[plantuml]
....
Alice -> Bob: Hello
....
----

=== Draw.io(Kroki 経由)

[source,asciidoc]
----
[drawio]
....
(draw.io の XML)
....
----

CAUTION: Kroki を有効化すると、PlantUML / Draw.io の図はレンダリングのために
文書の内容が外部の Kroki サーバーへ送信されます。設定画面で Kroki を有効化する
前に、送信先サーバーの信頼性を確認してください。

== エクスポート/印刷

* HTML エクスポートと PDF / 印刷は、現在のテーマ設定に関わらず常にライト配色で
  出力されます(意図した仕様です)
* PDF 出力はアプリ内 \`window.print()\` から OS の印刷ダイアログ(「PDF として保存」)
  を呼び出す方式です。Windows(WebView2)では動作確認済みですが、macOS/Linux の
  WebKit 系バックエンドでは印刷ダイアログの挙動が不安定な既知の問題があります

== 保管庫

* 「フォルダを開く」で選んだフォルダの中身をサイドバーのファイルツリーに
  表示します。対応拡張子(adoc / asciidoc / asc / txt)以外のファイルは
  表示されません
* ドットで始まるファイル・フォルダと、空のフォルダは表示されません
* ファイル監視は行っていません。フォルダ外で変更があった場合はサイドバー右上の
  ↻ ボタンで手動更新してください

== タブと未保存データ

* 未保存の変更があるタブを Ctrl+W で閉じようとすると、破棄してよいか確認
  ダイアログが出ます
* ウィンドウの ✕ ボタンでアプリを終了しようとしたときも、いずれかのタブに
  未保存の変更があれば同様に確認ダイアログが出ます
`;
