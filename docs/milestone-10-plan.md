# Milestone 10: プレビューのコードブロック・シンタックスハイライト

## 目標

`[source,言語]` のコードブロックを、プレビューと HTML エクスポートの両方で
言語別に色付けする。オフライン完結(CDN 依存なし)・ダーク/ライトテーマ追従を必須とする。

## 前提調査(実物確認の結果)

@asciidoctor/core 3.0.4(Asciidoctor 2.0.20)の実出力を確認した(推測ではない):

- **属性なしでも** embedded 出力は
  `<pre class="highlight"><code class="language-javascript" data-lang="javascript">`
  と言語クラス・`data-lang` 付きで出る。`[source]`(言語なし)は `<code>` のみ、
  無印リテラルブロック(`----`)は `<pre>` のみ。
- `source-highlighter: highlight.js` を付けると、embedded では `hljs` /
  `highlightjs` クラスが増えるだけ。standalone では **cdnjs の highlight.js
  9.18.3(古い)への link/script が注入される** — CDN 依存でオフライン要件に反する。

→ **`source-highlighter` 属性は使わない**。Asciidoctor のデフォルト出力
(言語クラス付き)をそのまま使い、highlight.js v11 をローカルバンドルして
変換後の DOM に自前で適用する。

## スコープ

1. **core/highlight-lang.ts(新規・テストファースト)** — 対応言語の正規化ロジック
2. **プレビューへの適用** — `ui/highlight.ts` 新規 + `ui/preview.ts` に decorate 追加
3. **トークン配色 CSS** — Slate トークン準拠の自前パレット(ライト/ダーク)
4. **HTML エクスポートへの焼き込み** — スクリプト同梱なしの静的ハイライト
5. **サンプル文書更新** — `sample/03-blocks.adoc` に言語サンプル追加

スコープ外(roadmap どおり): エディタ(CodeMirror)側のコードブロック内
ネスト言語ハイライト、行番号表示、コピーボタン。

## 依存ライブラリ

- `highlight.js` ^11 を dependencies に追加。
- バンドル肥大を避けるため `highlight.js/lib/core` +
  `highlight.js/lib/languages/*` の個別登録方式にする
  (フルビルドは全 190+ 言語で数百 KB になるため)。

### 対応言語セット(設計判断① — 要擦り合わせ)

登録候補(hljs の言語モジュール名。1言語あたり数 KB):

> javascript, typescript, json, xml(html を含む), css, bash(sh/shell),
> python, java, c, cpp, csharp, go, rust, ruby, sql, yaml, ini(toml を含む),
> diff, dockerfile, kotlin

エイリアス(`js` → `javascript`、`html` → `xml` など)は hljs 本体の
定義に任せず、core 側の明示的なマップで解決する(下記)。
未対応言語は色なしのプレーン表示(現状と同じ見た目)にフォールバックする。

## 設計

### core/highlight-lang.ts(純粋ロジック・テストファースト)

```
SUPPORTED_LANGUAGES: string[]            // hljs に登録するモジュール名の一覧
resolveHighlightLanguage(dataLang: string | null): string | undefined
```

- `data-lang` 属性値(小文字化)→ hljs の正規言語名への解決。
  エイリアス表(`js`/`jsx` → `javascript`、`ts` → `typescript`、
  `sh`/`shell`/`zsh` → `bash`、`html`/`svg` → `xml`、`yml` → `yaml`、
  `c++` → `cpp`、`c#` → `csharp`、`toml` → `ini`、`docker` → `dockerfile` など)
- 未知の言語・null は `undefined` を返す(呼び出し側はスキップ)
- DOM / hljs import なしの純粋データ+関数。`highlight-lang.test.ts` に
  日本語 describe/it で仕様を書いてから実装する

### ui/highlight.ts(新規・薄い DOM 層)

```
highlightCodeBlocks(root: ParentNode): void
```

- `root.querySelectorAll("pre.highlight > code[data-lang]")` を走査し、
  `resolveHighlightLanguage` で解決できたものだけ
  `hljs.highlight(el.textContent, { language })` の結果を `innerHTML` に設定
- hljs core の import と `SUPPORTED_LANGUAGES` の registerLanguage を
  このモジュールの初期化時に行う(main.ts に配線を増やさない)
- プレビューとエクスポートの両方から呼ぶ共通関数にする

### サニタイズとの整合(XSS 防壁を壊さないこと)

- 適用順は **sanitize → innerHTML 反映 → highlightCodeBlocks**。
  hljs は `textContent`(サニタイズ済み DOM のテキスト)だけを入力に、
  自前でエスケープした `<span class="hljs-*">` マークアップを生成するため、
  パススルー由来の生 HTML が復活する経路はない
- 前提となる「DOMPurify が `pre`/`code` の class と `data-lang` を通す」ことを
  render のサニタイザテストに1ケース追加して固定する
  (DOMPurify はデフォルトで class と `data-*` を許可するが、仕様として明文化)

### ui/preview.ts への組み込み

- `render()` 内の decorate 群に `decorateCodeBlocks()`(= `highlightCodeBlocks(previewEl)`)
  を追加。折り返し・高さが変わりうるので **`rebuildHeadingAnchors` より前**に実行
- パフォーマンス: 再描画ごとに全ブロック再ハイライトする素朴な方式で始める。
  レンダリングはデバウンス済みで、ステータスバーに変換 ms が出るため実測で監視。
  未対応言語ブロックは hljs を呼ばずスキップするので無駄がない

### トークン配色(styles.css — 設計判断②)

hljs 既製テーマ CSS は色が固定値でテーマ追従できないため使わない。
Slate パレットに合わせた小さなトークン変数を自前定義する:

```
--hl-keyword / --hl-string / --hl-comment / --hl-number /
--hl-title(関数・クラス名) / --hl-attr / --hl-meta
```

- 定義箇所は既存テーマ変数と同じ3箇所(`:root` ライト既定 /
  `prefers-color-scheme: dark` メディアクエリ / `[data-theme="dark"]`)
- `.adoc .hljs-keyword { color: var(--hl-keyword); }` 形式で
  hljs のクラス群をこの変数にマップする。hljs のクラスは細かい
  (`hljs-built_in`、`hljs-literal` など)ので、7変数程度に集約して割り当てる
- `@media print` の強制ライト化ブロックにも変数の上書きを追記する
  (印刷/PDF はライト配色で出す)

### HTML エクスポートへの焼き込み(設計判断③)

standalone HTML にはスクリプトを同梱せず、**変換時にハイライト済み HTML を
焼き込む**(オフライン完結・開くだけで色付き):

- `ui/highlight.ts` に `bakeHighlightIntoStandaloneHtml(html: string): string` を追加:
  `DOMParser` でパース → `highlightCodeBlocks(doc)` → トークン配色の
  `<style>`(ライト固定の具体値)を head に追記 → 直列化して返す
- main.ts のエクスポート配線で `convertToStandaloneHtml` の結果に適用する
- **エクスポートを sanitize しない方針は維持**: hljs はコードブロックの
  テキストを読んで置き換えるだけで、パススルー等の他要素には触れない

### サンプル文書(sample/03-blocks.adoc)

- 既存のコードブロック例に加え、2〜3言語(例: JavaScript / Python / JSON)の
  `[source,言語]` サンプルを追加し、説明文を実挙動(対応言語で色付き・
  未対応はプレーン)に一致させる

## 設計判断まとめ

1. **対応言語セット**(上記 20 言語案)— *→ ユーザーと要擦り合わせ*
2. **`source-highlighter` 属性を使わない** — 実測で CDN(しかも hljs 9.x)注入を
   確認したため。デフォルト出力に言語クラスが既にあり、属性なしで足りる
3. **既製テーマ CSS を使わず自前トークン変数** — ダーク/ライト追従と
   Slate デザイン準拠(design-direction.md)のため
4. **エクスポートは焼き込み方式** — スクリプト同梱は HTML が肥大し、
   閲覧側の JS 実行にも依存する。静的な span+style が最も堅牢
5. **ハイライトはサニタイズ後に適用** — hljs 出力はエスケープ済みテキスト起点で
   span/class のみなので、防壁の後段に置いても安全(上記「サニタイズとの整合」)

## モジュール構成(差分)

```
src/
  core/highlight-lang.ts       新規: 対応言語一覧 + エイリアス解決(純粋・テスト付き)
  core/highlight-lang.test.ts  新規: 解決仕様(エイリアス・未知言語・null)
  ui/highlight.ts              新規: hljs 登録 + highlightCodeBlocks + エクスポート焼き込み
  ui/preview.ts                decorateCodeBlocks を render に追加
  render.ts                    (変更なし。サニタイザテストに1ケース追加)
  main.ts                      配線: エクスポート時の焼き込み適用
src/styles.css                 --hl-* トークン変数(3箇所)+ .hljs-* マップ + print 追記
sample/03-blocks.adoc          言語サンプル追加
package.json                   highlight.js 追加
```

## 実施順序(1機能 = 1コミット、ブランチ: feature/milestone-10-syntax-highlight)

1. `core/highlight-lang.ts` — テストファーストで言語解決ロジック
   (+ highlight.js 依存追加)
2. `ui/highlight.ts` + preview 組み込み + トークン配色 CSS
   (プレビューで色が付く状態。サニタイザテスト追加もここ)
3. HTML エクスポート焼き込み + print 対応
4. サンプル文書更新

## 検証

- `npm test` / `npm run build`(バンドルサイズの増分を build 出力で確認)
- ブラウザプレビューでスモークテスト:
  - 対応言語(js/python/json)で色付き、未知言語・言語なしでプレーン表示
  - ダーク/ライト切り替えでトークン色が追従すること
  - パススルーブロックに `<script>` を書いてもプレビューで実行されないこと
    (サニタイズ回帰確認)
  - ステータスバーの変換 ms が悪化していないこと
- HTML エクスポートは Tauri 実機確認(`verify-tauri` スキルに
  「エクスポートした HTML をブラウザで開きオフラインで色付き表示」を追記)
