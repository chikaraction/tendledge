# @asciidoctor/core 4 移行メモ

Issue [#12](https://github.com/chikaraction/tendledge/issues/12) の作業ブランチ `feature/asciidoctor-4` 用の
事前調査結果と実装計画。**調査は 4.0.8 を実際にインストールして実行・出力比較で確認したもの**であり、
推測は含まない(未確認事項は末尾に分けて書く)。

## 前提

- `package.json` / `package-lock.json` は **すでに 4.0.8 へ更新済み**(この文書のコミット時点では
  作業ツリー上の未コミット変更)。最初の実装コミットに含めること。
- Dependabot の PR #9 は 2026-08-14 にクローズ済み。移行はこのブランチで行う。

## 確認した事実

### 1. パッケージ構造と API

`exports` マップが `dist/{node,browser}/asciidoctor.js` から
`build/node/index.cjs`(require)/ `build/browser/index.js`(browser)/ `src/index.js`(import)へ変わった。
デフォルトエクスポート(ファクトリ関数)は廃止され、トップレベルの名前付きエクスポートになった。

```ts
// v3
import Asciidoctor from "@asciidoctor/core";
const asciidoctor = Asciidoctor();
const doc = asciidoctor.load(src, opts);
const html = doc.convert() as string;

// v4
import { convert, load, Extensions } from "@asciidoctor/core";
const doc = await load(src, opts);
const html = await doc.convert();
```

`types/convert.d.ts` / `types/load.d.ts` / `types/document.d.ts` / `types/abstract_block.d.ts` の
いずれも戻り値が `Promise` で、**同期版の API は提供されていない**。

### 2. HTML 出力はほぼ完全に同一

v4 は Opal 経由ではなく JS への全面書き直しだが、出力は変わっていない。
見出し / アドモニション / チェックリスト / 表 / 例示 / サイドバー / 引用 / 画像 /
定義リスト / TOC / バイラインを含む総合サンプルを v3(3.0.4)と v4(4.0.8)で変換して
diff した結果、差分は次の 2 点だけだった。

| 箇所 | v3 | v4 |
| --- | --- | --- |
| 表の列幅 | `<col style="width: 50%;">` | `<col width="50%">` |
| generator meta | `Asciidoctor 2.0.20` | `Asciidoctor.js 4.0.8` |

つまり `ui/admonition-icons.ts` / `ui/checklist-decoration.ts` / `ui/code-highlight.ts` /
`core/headings.ts`(スクロール同期の h1〜h6 ペアリング)/ `standalone: true` が出す
`#header .details`(バイライン)はいずれも**構造不変**で、既存の特性化テストはそのまま通る想定。
列幅は非推奨の属性形式に退化するが、ブラウザでの表示には効く。

### 3. Extensions の DSL は維持されている

`registerNormalizeBlock`(mermaid / plantuml / drawio / diagramsnet の正規化拡張)で使っている
`Extensions.register(function () { this.block(function () { ... }) })` の DSL 形式、
`named` / `onContexts` / `parseContentAs` / `process` / `createBlock` / `setTitle` /
`reader.getLines()` はすべて v4 でも動作する。実際に走らせて次を確認済み:

- `[mermaid]` → `<code class="language-mermaid" data-lang="mermaid">` への正規化
- `.タイトル` の引き継ぎ(`setTitle`)
- **2回目以降の変換でも正規化が効き続ける**(v3 で registry 渡し方式が素通しになった問題は再発しない)
- `[mermaid]` と `[source,mermaid]` の出力が完全一致

よって render.ts の変更は import 形式と `asciidoctor.Extensions` → `Extensions` の書き換えだけで済む。

### 4. jsdom + Vitest でブラウザビルドが読み込める

`// @vitest-environment jsdom` 下で `import { convert, getVersion } from "@asciidoctor/core"` を
実行し、`getVersion() === "4.0.8"`・`await convert("hello", { safe: "safe" })` が
`<p>hello</p>` を返すことを確認した(Vite が `browser` 条件で `build/browser/index.js` を解決する)。

## 実装計画

| # | 対象 | 内容 |
| --- | --- | --- |
| 1 | `src/render.ts` | `import { convert, load, Extensions } from "@asciidoctor/core"` へ。`Document` は `import type` のまま。モジュールスコープの `const asciidoctor = Asciidoctor()` を削除し、`asciidoctor.Extensions` → `Extensions`、`asciidoctor.load` → `load`、`asciidoctor.convert` → `convert` |
| 2 | `src/render.ts` | `convertToPreviewHtml` / `convertToStandaloneHtml` を `async` 化(戻り値 `Promise<string>`)。`doc.convert()` に `await`。`as string` キャストは `convert()` の戻り型が `Document \| string` のため standalone 側では引き続き必要 |
| 3 | `src/render.ts` | `stylesheet: false` のコメントを書き直す。現在の理由(Opal ランタイムの同期 XHR ポリフィルが Vite dev サーバーの index.html フォールバックを `<style>` に埋め込む)は v4 では成り立たない。既定 CSS を出させないための指定として理由を書き換える |
| 4 | `src/ui/preview.ts` | `render()` を `async` 化。**`await` の後・`innerHTML` 代入の直前**に `if (generation !== renderGeneration) return;` を置く(同関数の `decorateDiagrams` 127 行目と同じイディオム)。await が入ると代入前に世代が入れ替わりうるため、これが無いと古い変換結果が新しいプレビューを上書きする |
| 5 | `src/ui/preview.ts` | `try/catch` を async 関数内に移す(変換エラー時に直前のプレビューを保持しステータスだけ「変換エラー」にする挙動は維持)。変換 ms の計測範囲コメントを更新する(「同期部分だけ」ではなく非同期変換込みの実時間になる) |
| 6 | `src/ui/html-export.ts` | 43 行目を `await convertToStandaloneHtml(source)` に。既に `async` 関数内なので他に影響なし |
| 7 | `src/render.test.ts` / `src/sanitize.test.ts` | 機械的な async/await 化(計31件)。**先に現在の出力を特性化テストで固定してから**移行する |
| 8 | `src/core/byline.ts` の 6〜8 行目 | コメントが `dist/node/asciidoctor.js` の行番号を指しているので v4 のパス(`src/converter/html5.js`)に更新する |

`src/main.ts` は変更不要。`preview.render` は元から `Promise<void>` を返しており、
219 / 546 / 551 行はすでに await / `void` で扱われている。

## 検証

- `npm test`(332件すべて green になること。v3 時点では render/sanitize の 2 スイート 31 件が
  読み込み時点で落ちて 301/332 だった)
- `npm run build`(tsc の型チェックが本丸。async 化の波及が全部拾えているか)
- 実機確認(`npm run tauri dev`)—— `verify-tauri` スキルの手順に沿って:
  - プレビューが打鍵に追従する / 高速に打鍵しても古い結果で上書きされない(世代ガードの確認)
  - HTML エクスポート・PDF(印刷)エクスポート
  - mermaid 図・PlantUML(Kroki)図の表示とエクスポートへの焼き込み

## 未確認事項

- 表の `<col width="50%">` が DOMPurify のサニタイズを通過するか(通過しなければプレビューで
  列幅が失われる)。`sanitize.test.ts` に 1 ケース足して確認するのが早い。
- v4 の変換速度が v3 と比べてどうか。プレビューのデバウンス既定値(300ms)の見直しが
  必要になるほどの差があるかは未測定。
