# Milestone 11: 作図① Mermaid

## 目標

`[mermaid]` / `[source,mermaid]` ブロックをプレビューで図としてレンダリングする。
mermaid.js のローカルバンドルによるクライアントサイド完結(オフライン動作・
文書内容の外部送信なし)、ダーク/ライトテーマ追従、XSS 防壁
(`sanitizePreviewHtml`)の維持を必須とする。HTML エクスポートには SVG を焼き込む。

## 前提調査(実物確認の結果)

@asciidoctor/core 3.0.4 の実出力を確認した(推測ではない):

- `[source,mermaid]` + `----` は
  `<pre class="highlight"><code class="language-mermaid" data-lang="mermaid">`
  と **`data-lang` 付きで出る** — DOM から確実に拾える。
- 一方 `[mermaid]` + `----` は素の Asciidoctor では**スタイルが完全に落ち**、
  ただの `<div class="listingblock"><pre>` になる(class も data 属性も残らない)。
  HTML からは通常のリスティングブロックと区別できない。
- Asciidoctor.js のブロック拡張(`named('mermaid')` / `onContexts(['listing','literal'])` /
  `parseContentAs('raw')` で `style: 'source', language: 'mermaid'` の listing を
  返す)を登録すると、`[mermaid]` ブロックが `[source,mermaid]` と**同一の
  HTML 出力に正規化される**ことを実測で確認した。

→ **`[source,mermaid]` を正とし、`[mermaid]` は拡張で source,mermaid に正規化**する。
Asciidoctor Diagram の慣習(`[mermaid]`)で書かれた文書もそのまま動き、
後段(プレビュー/エクスポート)は `data-lang="mermaid"` だけを見ればよい。

## スコープ

1. **render.ts への拡張登録** — `[mermaid]` → `source,mermaid` 正規化(+特性化テスト)
2. **core/diagram.ts(新規・テストファースト)** — mermaid テーマ解決などの純粋ロジック
3. **ui/mermaid.ts(新規)** — mermaid.js の遅延ロード・レンダリング・SVG サニタイズ
4. **プレビューへの組み込み** — 非同期 decorate(世代ガード付き)+ アンカー再構築
5. **テーマ追従** — テーマ変更・system 時の OS 設定変更で図を再レンダリング
6. **HTML エクスポートへの SVG 焼き込み**
7. **サンプル文書** — `sample/07-diagrams.adoc` 新設

スコープ外: PlantUML / Draw.io(M12・Kroki 経由)、図の GUI 編集、
エディタ(CodeMirror)側での mermaid 記法ハイライト
(`----` ブロックとしての既存表示のままとする)。

## 依存ライブラリ

- `mermaid` ^11 を dependencies に追加。
- **バンドルが非常に大きい**(minify 後 1MB 超)ため、静的 import はせず
  `ui/mermaid.ts` 内で **dynamic import** する。Vite が自動でチャンク分割するので、
  mermaid ブロックを含む文書を開くまでロードコストゼロ。
  初回ロード中は「図を準備中…」のプレースホルダを出す。

## 設計

### render.ts — ブロック拡張(正規化)

- モジュール初期化時に `asciidoctor.Extensions.create()` で registry を作り、
  `[mermaid]`(listing / literal 両コンテキスト)を
  `createBlock(parent, 'listing', source, { style: 'source', language: 'mermaid' })`
  に変換する拡張を登録。`convertToPreviewHtml` / `convertToStandaloneHtml` の
  両方に `extension_registry` として渡す。
- テスト: 「`[mermaid]` ブロックが `data-lang="mermaid"` 付き HTML になる」
  「`[source,mermaid]` の出力と一致する」を render のテストに特性化として追加。

### core/diagram.ts(純粋ロジック・テストファースト)

```
resolveMermaidTheme(theme: Theme, prefersDark: boolean): "default" | "dark"
MERMAID_LANG = "mermaid"   // data-lang の判定に使う定数
```

- アプリのテーマ設定("system" / "light" / "dark")と OS のダーク判定から
  mermaid のテーマ名を解決する。`diagram.test.ts` に日本語 describe/it で
  仕様を書いてから実装(DOM / mermaid import なし)。
- レンダリング結果のキャッシュキー生成(`テーマ + ソース` の結合)も
  ここに置き、テストで固定する。

### ui/mermaid.ts(新規・DOM 層)

```
renderMermaidBlocks(root: ParentNode, theme: MermaidTheme): Promise<boolean>
  // mermaid ブロックが1つでもあれば処理して true(高さ変化の通知に使う)
```

- `root.querySelectorAll('code[data-lang="mermaid"]')` を走査し、
  各ブロックの `textContent`(= サニタイズ済み DOM のテキスト)を入力に
  `mermaid.render()` で SVG を得て、`listingblock` 全体を図コンテナ
  (`<div class="mermaid-diagram">`)に差し替える。
- mermaid 本体は初回呼び出し時に dynamic import し、
  `mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme })` で
  初期化。テーマが変わったら initialize し直す。
- **キャッシュ**: `テーマ + ソース` → SVG 文字列の `Map`。デバウンス再描画の
  たびに全図を再レンダリングしない(mermaid.render は1図あたり数十 ms かかる)。
  上限件数を超えたらクリアする素朴な方式でよい。
- **エラー処理**: 構文エラー時は元のコードブロックを残し、その直下に
  エラーメッセージ(mermaid の例外メッセージ)を小さく表示する。
  プレビュー全体は壊さない。

### サニタイズとの整合(XSS 防壁を壊さないこと)

適用順は **sanitize → innerHTML 反映 → mermaid レンダリング → SVG を再サニタイズして挿入**:

- mermaid への入力はサニタイズ済み DOM の `textContent` のみ(生 HTML が
  復活する経路はない)。`securityLevel: "strict"`(既定)でラベル内の
  スクリプト・クリックイベントは mermaid 側でも無効化される。
- さらに多層防御として、生成 SVG を挿入前に DOMPurify の SVG プロファイル
  (`USE_PROFILES: { svg: true, svgFilters: true }`)で通す
  (`sanitizeMermaidSvg` を render.ts に追加し、テストで
  `<script>` / イベント属性 / `foreignObject` が落ちることを固定する)。
- **htmlLabels を無効化**(`flowchart: { htmlLabels: false }` 等)し、ラベルを
  `foreignObject` 内 HTML ではなく純粋な SVG text で出させる。
  これで SVG プロファイルのサニタイズと両立する。
- ⚠ 実装時に実物確認する点: mermaid SVG は内部に `<style>` 要素を含むため、
  DOMPurify の設定で `<style>` が落ちないこと(落ちる場合は `ADD_TAGS` で許可し、
  style 内容は mermaid 生成のものだけなので許容できるか判断する)。
  `suppressErrorRendering` オプション(エラー時に body へ error div を
  注入させない)の有無・挙動も v11 実物で確認する。

### ui/preview.ts への組み込み(非同期 decorate)

既存の `render()` は同期パイプラインなので、mermaid は後段の非同期 decorate として足す:

- `render()` 末尾で `decorateMermaid()` を fire-and-forget(`void`)で起動。
  **世代カウンタ**を持ち、完了時に世代が進んでいたら結果を捨てる
  (連打入力でのレース対策)。
- 図の挿入で要素の高さが変わるため、mermaid 完了後に
  **`rebuildHeadingAnchors(source)` を再実行**する(スクロール同期のずれ防止)。
  直近の source を保持しておく。
- 変換 ms のステータス表示は同期部分の計測のまま変えない
  (mermaid の所要時間は含めない。キャッシュが効けば2回目以降はほぼゼロ)。

### テーマ追従

- mermaid のテーマは SVG に焼き込まれるため、CSS 変数では追従できない。
  **テーマ変更時にプレビューを再レンダリング**する: main.ts の `applySettings` で
  実効テーマ(resolveMermaidTheme の結果)が変わったときに
  `preview.render(現在のソース)` を呼ぶ配線を足す。
- `theme: "system"` のときは `matchMedia("(prefers-color-scheme: dark)")` の
  change イベントでも同様に再レンダリングする。
- **印刷/PDF**: `@media print` はライト配色を強制するが、ダークテーマで
  レンダリング済みの SVG はダークのまま印刷されてしまう。`exportPdf()` は
  自前のコードなので、**ダーク時は印刷前に default テーマで図を再レンダリング
  →`window.print()`→元に戻す**(async 化して await できる)。

### HTML エクスポートへの焼き込み(SVG 焼き込み方式)

M10 の焼き込み方式と同じ思想(スクリプト同梱なし・開くだけで表示):

- `ui/mermaid.ts` に `bakeMermaidIntoStandaloneHtml(html: string): Promise<string>` を
  追加: `DOMParser` でパース → `renderMermaidBlocks(doc, "default")`(ライト固定)
  → 直列化して返す。`exportHtml()` は既に async なので配線は await を挟むだけ。
- **エクスポートを sanitize しない方針は維持**: mermaid ブロックだけを
  置き換え、パススルー等の他要素には触れない。焼き込む SVG 自体は
  プレビューと同じ `sanitizeMermaidSvg` を通す。

### サンプル文書(sample/07-diagrams.adoc)

- `[mermaid]` と `[source,mermaid]` の両記法で、フローチャート・
  シーケンス図・状態遷移図あたりを 3〜4 例。
- 「オフラインで動く・外部送信なし」「構文エラー時はコードとエラーが出る」
  という実挙動どおりの説明文を付ける。誤り例(エラー表示の確認用)も1つ入れる。

### CSS(styles.css)

- `.mermaid-diagram` コンテナ: 中央寄せ・上下マージン・横幅超過時の
  `overflow-x: auto`。エラーメッセージ用の小さなスタイル。
  `@media print` での改ページ抑制(`break-inside: avoid`)。

## 設計判断まとめ

1. **`[mermaid]` はブロック拡張で `source,mermaid` に正規化** — 実測で
   素の Asciidoctor ではスタイルが HTML に残らないと確認したため。
   後段の処理系は `data-lang="mermaid"` の1経路に統一できる
2. **mermaid は dynamic import で遅延ロード** — バンドルが 1MB 超のため。
   図のない文書では一切ロードしない
3. **SVG はレンダリング後に再サニタイズして挿入 + htmlLabels 無効化** —
   防壁の多層化。入力がテキスト起点なので理論上安全だが、
   mermaid 側の脆弱性に対する保険として DOMPurify SVG プロファイルを通す
4. **テーマは再レンダリングで追従(SVG 焼き込みのため CSS 変数不可)** —
   キャッシュをテーマ込みのキーにして切り替えを軽くする
5. **エクスポートは SVG 焼き込み(ライト固定)・印刷はダーク時に一時再レンダリング** —
   M10 の焼き込み方針と整合。スクリプト同梱は肥大と閲覧側 JS 依存のため不採用
6. **エラー時はコードブロック温存 + エラー表示** — 図に化けて内容が
   消えるより、書きかけの構文が見えるほうが編集体験がよい

## モジュール構成(差分)

```
src/
  core/diagram.ts         新規: mermaid テーマ解決・キャッシュキー(純粋・テスト付き)
  core/diagram.test.ts    新規: テーマ解決仕様(system×OS設定・light・dark)
  ui/mermaid.ts           新規: 遅延ロード + renderMermaidBlocks + エクスポート焼き込み
  ui/preview.ts           decorateMermaid(非同期・世代ガード)+ アンカー再構築
  render.ts               [mermaid] 正規化拡張 + sanitizeMermaidSvg(テスト追加)
  main.ts                 配線: テーマ変更時の再レンダリング・印刷前の再レンダリング・
                          エクスポート焼き込み
src/styles.css            .mermaid-diagram + エラー表示 + print 追記
sample/07-diagrams.adoc   新規
package.json              mermaid 追加
```

## 実施順序(1機能 = 1コミット、ブランチ: feature/milestone-11-mermaid)

1. render.ts の `[mermaid]` 正規化拡張(特性化テスト付き)
2. `core/diagram.ts` — テストファーストでテーマ解決・キャッシュキー
   (+ mermaid 依存追加)
3. `ui/mermaid.ts` + preview 非同期組み込み + `sanitizeMermaidSvg` + CSS
   (プレビューで図が出る状態)
4. テーマ追従(設定変更・system 変更・印刷前の再レンダリング)
5. HTML エクスポート焼き込み
6. サンプル文書 `sample/07-diagrams.adoc`

M10(シンタックスハイライト)とはファイル的にほぼ独立
(`ui/highlight.ts` は未知言語をスキップするので mermaid ブロックと干渉しない)だが、
`ui/preview.ts` の decorate 追加が両方に入るため、**M10 実装のマージ後に着手**する
(roadmap の推奨順どおり)。

## 検証

- `npm test` / `npm run build`(mermaid が別チャンクに分割されること・
  初期バンドルが肥大していないことを build 出力で確認)
- ブラウザプレビューでスモークテスト:
  - `[mermaid]` / `[source,mermaid]` 両記法で図が出る、
    図のない文書で mermaid チャンクがロードされない(Network で確認)
  - 構文エラーでコード+エラー表示になり、プレビュー全体は壊れない
  - テーマ切り替え(light/dark/system)で図の配色が追従する
  - mermaid ブロックのラベルに `<script>` や `onclick` を書いても実行されない
    (サニタイズ回帰確認)
  - 図を含む文書でスクロール同期がずれない(図レンダリング後のアンカー再構築)
  - 入力連打(デバウンス)でちらつき・古い図の混入がないこと(世代ガード)
- Tauri 実機確認(`verify-tauri` スキルに追記):
  - エクスポートした HTML をオフラインのブラウザで開き、図が表示される
  - ダークテーマ状態から PDF 印刷し、図がライト配色で出る
