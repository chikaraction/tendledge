# エクスポート/印刷の設計メモと既知の落とし穴

PDF(印刷)とスタンドアロン HTML エクスポートに関する設計判断の記録と、
過去に実際に踏んだ罠のメモ。**エクスポート/印刷まわりのコードを触る前に一読すること**
(CLAUDE.md から参照されている。ここに書いてある挙動は「バグ」ではなく確定した設計)。

## 設計判断: どちらもライトモード固定

**PDF/印刷もスタンドアロン HTML エクスポートも、アプリの現在のテーマに関係なく
意図的にライトモード固定**(確定した設計判断であり、バグではない)。
ダークでのエクスポート/印刷は検討のうえ却下した:

- ダークな PDF はインク/トナーの無駄。
- スタンドアロン HTML は「後から誰が開いても同じに見える」べきで、
  *閲覧者*の OS/ブラウザ設定にも、*書いた人*がエクスポートした瞬間のテーマにも
  依存すべきでない。

## PDF/印刷の仕組みと割り切り

- 実装は `window.print()` + [src/styles.css](../src/styles.css) の `@media print` ブロック。
  `.adoc` 以外(メニューバー・タブバー・サイドバー・ステータスバー・エディタ)をすべて隠し、
  CSS 変数をライト側に強制する。
- Windows/WebView2 では信頼して使えるが、macOS/Linux の WebKit ベース Tauri ビルドには
  印刷ダイアログの既知の不安定さがある — **許容したトレードオフ**であり、
  PDF ライブラリを追加して「直す」対象ではない。

## 踏んだ罠 (1): `@media print` の `:root` 上書きには `!important` が要る

アプリ本体の `:root[data-theme="dark"]` ルールは詳細度 0-2-0 で、
`@media print` 内の素の `:root`(0-1-0)による上書きより強い。
そのため、ダークテーマを明示選択している状態では `!important` なしの
印刷用ライト変数が負ける。印刷用の `:root { --bg: ... }` 上書きには
`!important` が必須。

## 踏んだ罠 (2): エクスポート HTML への `color-scheme: light dark` のリーク

[src/ui/html-export.ts](../src/ui/html-export.ts) がコピーする `:root` ブロックに
`color-scheme: light dark` を残してはいけない。エクスポート文書自体は `body` に
明示的な背景色/文字色を持たないので、これが残っていると*閲覧側*のブラウザが
ダーク設定のときにキャンバスを暗く塗り、ライト固定の `.adoc` コンテンツ色と衝突する。
対策として、抽出ルールの後で `color-scheme: light` を強制し、明示的な
`body { background/color }` を出力している。

## スタンドアロン HTML エクスポートの後処理パイプライン

[src/ui/html-export.ts](../src/ui/html-export.ts) は [src/render.ts](../src/render.ts) の
`convertToStandaloneHtml` の素の出力をそのまま使わず、ライブプレビューと同じ見た目に
なるよう後処理する:

- **CSS**: `core/export-css.ts` が [src/styles.css](../src/styles.css) から `:root` と
  `.adoc` スコープのルールだけを抽出して埋め込む(`?raw` import 経由 —
  [src/vite-env.d.ts](../src/vite-env.d.ts) 参照)。手書き複製の CSS スニペットが
  本体とズレていく問題を防ぐため。**`@media` ブロックは抽出時に丸ごと捨てる** —
  これがライト固定を保っている仕組みそのもの。
- **装飾**: 警告(admonition)アイコンとチェックリストのチェックボックスは、
  ライブプレビューと同じ DOM ロジック([src/ui/admonition-icons.ts](../src/ui/admonition-icons.ts)、
  [src/ui/checklist-decoration.ts](../src/ui/checklist-decoration.ts))を
  `DOMParser` でパースしたスタンドアロン HTML に対して共用する。
  - アイコンの挿入は `XMLSerializer` の文字列往復で行う
    (document をまたぐノード adoption の問題を回避するため)。
  - チェックボックスの状態は `.checked` ではなく **`.defaultChecked`** で設定すること。
    シリアライズ可能な `checked` *属性*に反映されるのは `defaultChecked` だけで、
    `.checked` はライブ DOM 限りの状態のため `outerHTML` で黙って落ちる。
- **byline 除去**: `standalone: true` が自動生成する著者行はライブプレビューには
  存在しないので後処理で取り除く(WYSIWYG: エディタに表示されないものを
  エクスポートが足してはいけない)。

## 既知の制限: `link:` マクロの `.adoc` リンクは変換されない

文書間リンクの href は記法によって挙動が異なる(2026-07-13 に実測確認):

- `xref:foo.adoc[…]` / `<<foo.adoc#sec,…>>` → `outfilesuffix`(既定 `.html`)により
  **自動で `foo.html` に変換される**。フラグメントも維持される。
- `link:foo.adoc[…]` → `link:` マクロは対象を素通しする仕様のため **`.adoc` のまま**。
- 外部 URL(`https://…/x.adoc`)は素通し(これは正しい挙動)。

対応状況:

- **スタンドアロン HTML エクスポート**: `buildExportHtml` の後処理で相対 `.adoc` href を
  `.html` へ書き換える対応を [backlog.md](backlog.md) に積んである(未実装)。
- **PDF(印刷)**: `window.print()` でライブプレビューをそのまま印刷する方式のため、
  書き換えるならプレビュー内リンクの挙動(アプリ内でクリックしたとき該当ファイルを
  エディタで開くか等)とセットで設計する必要がある。当面は既知の制限とし、
  文書間リンクには `xref:` 記法を推奨する(予定のヘルプページにも記載する)。

## サニタイズ方針との関係

プレビューに流す HTML は DOMPurify を通すが、**スタンドアロン HTML エクスポートは
意図的にサニタイズしない**(ユーザー自身のパススルーコンテンツを生かすため)。
詳細は CLAUDE.md の XSS の項を参照。
