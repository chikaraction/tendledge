# Milestone 12: 作図② PlantUML / Draw.io(Kroki 経由)

## 目標

`[plantuml]` / `[drawio]` ブロックをプレビューで図としてレンダリングする。
PlantUML / Draw.io はブラウザ内変換ができないため、図のソースを Kroki
(kroki.io または self-host)へ送って SVG を得る。**文書内容の一部を外部へ
送信する機能**なので、設定でのオプトイン(既定 OFF)+ サーバー URL 設定を必須とし、
オフライン・サーバー障害時はプレビューを壊さずコードブロックのまま表示する。

M11(Mermaid)で確立した「正規化拡張 → 非同期 decorate → 世代ガード →
アンカー再構築 → エクスポート焼き込み」の型をそのまま踏襲する。

## 前提調査(実物確認の結果・2026-07-07)

kroki.io に対して実リクエストで確認した(推測ではない):

- `POST https://kroki.io/plantuml/svg`(body = 図ソースの text/plain)は
  **200 で SVG を返す**。レスポンスに `Access-Control-Allow-Origin: *` が
  付くため、ブラウザ fetch でも CORS は問題にならない。
- `POST https://kroki.io/diagramsnet/svg` は **503
  (`Connection refused: /127.0.0.1:8005`)**。`/health` のバージョン表には
  `diagramsnet: 16.2.4` が載っており Kroki 本体としては対応しているが、
  **公開インスタンスではコンパニオンサービスが停止している**(時期依存の可能性あり)。
- → **Draw.io はベストエフォート扱い**とする: 実装は PlantUML と同一経路
  (図種別が違うだけ)なので含めるが、動作確認は「エラー表示が正しく出ること」まで。
  実際に図が出るのは self-host Kroki(`kroki-diagramsnet` コンパニオン込み)か
  kroki.io 復旧後になる。この制約はサンプル文書にも明記する。

## スコープ

1. **設定の拡張** — `krokiEnabled`(既定 false)/ `krokiServerUrl`
   (既定 `https://kroki.io`)。core/settings.ts + 設定ダイアログ
2. **render.ts への拡張登録** — `[plantuml]` / `[drawio]`(+ `[diagramsnet]`
   エイリアス)→ `source,<lang>` 正規化(M11 と同方式・特性化テスト)
3. **core/kroki.ts(新規・テストファースト)** — 図種別解決・リクエスト URL 構築・
   キャッシュキー・SVG→data URI 変換などの純粋ロジック
4. **tauri-plugin-http の導入** — Cargo.toml + capability(識別子は実物確認)
5. **ui/kroki.ts(新規)** — fetch(Tauri/ブラウザ両対応)・キャッシュ・`<img>` 差し替え
6. **プレビューへの組み込み** — decorateMermaid と並ぶ非同期 decorate(世代ガード共有)
7. **HTML エクスポートへの焼き込み**(data URI `<img>`。無効時は焼き込まない)
8. **サンプル文書** — `sample/07-diagrams.adoc` に PlantUML / Draw.io 節を追記

スコープ外:

- Draw.io の GUI 作図編集(roadmap どおり、必要なら M13 以降)
- PlantUML / Draw.io 以外の Kroki 図種別の明示サポート
  (経路上は動き得るが、サンプル・検証・正規化拡張の対象にしない)
- 横長の図の拡大表示(ライトボックス等)→ [backlog.md](backlog.md) で管理
- エディタ(CodeMirror)側の PlantUML 記法ハイライト

## 設計

### 設定(core/settings.ts — テストファースト)

```
krokiEnabled: boolean      // 既定 false(オプトイン)
krokiServerUrl: string     // 既定 "https://kroki.io"
```

- `mergeSettings`: `krokiEnabled` は boolean 以外を既定値へ。`krokiServerUrl` は
  「http:// または https:// で始まる」ことを検証し、不正値・空文字は既定値へ
  フォールバック(末尾スラッシュの正規化は core/kroki.ts の URL 構築側で行う)。
- `settings.test.ts` に仕様を先に書く(既存の流儀どおり)。
- 設定ダイアログに「作図(リモートレンダリング)」セクションを追加:
  有効化チェックボックス + サーバー URL テキスト入力 +
  「図のソースを設定先サーバーへ送信します」の注意書き。`getCurrent`
  プロバイダ経由の既存パターンに乗せる。

### render.ts — ブロック拡張(正規化)

M11 の `[mermaid]` 正規化と同じ registry に追加する:

- `[plantuml]` → `style: 'source', language: 'plantuml'`
- `[drawio]` / `[diagramsnet]` → `style: 'source', language: 'drawio'`
  (後段の data-lang を `drawio` に統一。`diagramsnet` は Kroki 側の呼称なので
  エイリアスとして受ける)
- 特性化テスト: 「`[plantuml]` が `data-lang="plantuml"` 付き HTML になる」
  「`[diagramsnet]` と `[drawio]` の出力が一致する」を render のテストに追加。

### core/kroki.ts(純粋ロジック・テストファースト)

```
KROKI_LANGS: readonly string[]                       // ["plantuml", "drawio"]
krokiDiagramType(lang: string): string | undefined   // "drawio" → "diagramsnet"
krokiRequestUrl(serverUrl: string, lang: string): string | undefined
    // 末尾スラッシュ正規化 + `${server}/${type}/svg`
krokiCacheKey(serverUrl: string, lang: string, source: string): string
svgToDataUri(svg: string): string
    // data:image/svg+xml;base64,... (UTF-8 対応の base64 化)
```

- DOM / Tauri / fetch に依存しない。`kroki.test.ts` に日本語 describe/it で
  仕様を書いてから実装する。
- キャッシュキーにサーバー URL を含める(サーバー切り替え後に別サーバーの
  結果を返さないため)。mermaid と違いテーマはキーに含めない
  (Kroki の SVG はテーマ非依存。後述)。

### HTTP 経路 — tauri-plugin-http を採用

**ブラウザ fetch ではなく `@tauri-apps/plugin-http` の fetch を使う。** 理由:

- CSP の `connect-src` は tauri.conf.json に静的に書くもので、
  **ユーザーが設定した self-host URL を実行時に許可できない**。
  plugin-http は Rust 側で通信するため page CSP / CORS の制約を受けず、
  許可範囲は capability の scope で管理できる。
- `img-src` に `data:` は既に許可済みなので、**CSP の変更は不要**。

導入手順(CLAUDE.md の流儀):

- `src-tauri/Cargo.toml` に `tauri-plugin-http`、package.json に
  `@tauri-apps/plugin-http` を追加し、lib.rs でプラグイン登録。
- capability には http の許可 + **scope で許可 URL を宣言**する必要がある。
  ユーザー設定の任意 URL に対応するため `http://**` / `https://**` の
  広い scope とする(通信自体がオプトインの機能なので許容。scope の正確な
  書式・パーミッション識別子は、ビルド後の `gen/schemas/desktop-schema.json` か
  installed crate の `permissions/` で**実物確認してから**書く。推測しない)。
- ブラウザプレビュー(`npm run dev`)では plugin-http が使えないため
  `window.fetch` にフォールバックする(kroki.io は CORS `*` を返すので動く。
  settings の in-memory フォールバックと同じ思想)。

### ui/kroki.ts(新規・DOM 層)

```
renderKrokiBlocks(root: ParentNode, opts: {
  serverUrl: string;
  fetchFn?: typeof fetch;   // テスト・フォールバック用に注入可能
}): Promise<boolean>        // 1つでも処理したら true(アンカー再構築の要否)
```

- `code[data-lang="plantuml"], code[data-lang="drawio"]` を走査し、
  `textContent` を `POST {server}/{type}/svg` に送り、返ってきた SVG を
  **`<img src="data:image/svg+xml;base64,...">` として挿入**する
  (`<div class="kroki-diagram">` コンテナに包み、`listingblock` を差し替え)。
- リクエスト中は `kroki-loading` クラス + 「図を取得中…」表示(mermaid と同様)。
- **キャッシュ**: `krokiCacheKey` → data URI の `Map`(上限超過でクリア、
  M11 と同じ素朴方式)。デバウンス再描画のたびに同一ソースを再送しない。
  **これが実質的なリクエスト抑制**になる(編集中も、変更されていない図は
  キャッシュヒットして通信ゼロ)。
- **タイムアウト**: `AbortController` で 10 秒。世代が進んだら(プレビューが
  描き直されたら)進行中のリクエストも abort する。
- **エラー処理**(M11 と同じ思想: コードブロック温存 + 直下にメッセージ):
  - HTTP 4xx → 「図の構文エラー」としてレスポンス本文(Kroki はプレーンテキストで
    エラー理由を返す)を表示
  - HTTP 5xx / ネットワークエラー / タイムアウト → 「サーバーに接続できません」系の
    表示(**オフラインフォールバック**。kroki.io の diagramsnet 停止もこの経路で
    ユーザーに伝わる)
  - エラーメッセージはプレビュー DOM に入れるため `textContent` で挿入する
    (サーバーのレスポンスを HTML として解釈しない)

### セキュリティ設計 — inline SVG ではなく `<img>` data URI にする理由

M11 の mermaid はローカル生成 SVG を DOMPurify(SVG プロファイル)で再サニタイズ
して inline 挿入したが、**Kroki の SVG は外部サーバー由来**であり、さらに
Draw.io の SVG はラベルを `foreignObject` 内 HTML で表現する(mermaid のように
`htmlLabels: false` で回避できない)。SVG プロファイルは `foreignObject` を
落とすため、inline 方式ではラベルが消えるか、防壁を緩めるかの二択になる。

`<img>` の data URI として埋め込めば、**画像コンテキストではスクリプト実行・
外部リソース読込が一切起きない**(ブラウザの仕様)ため、サニタイズと
表示品質を両立できる。トレードオフ(図内テキストの選択・コピー不可)は
リモート図では許容する。mermaid(ローカル・inline SVG)と方式が分かれるのは
**信頼境界が違うための意図的な差**であり、本文書をその記録とする。

### プレビューへの組み込み(ui/preview.ts)

- `createPreview` の opts に `kroki?: () => { enabled: boolean; serverUrl: string }`
  プロバイダを追加(main.ts が settings から供給)。
- `decorateMermaid` と並べて `decorateKroki` を起動し、既存の
  `renderGeneration` ガードを共有する。**両方の完了後に
  `rebuildHeadingAnchors(source)` を1回**実行する形に整理する
  (`Promise.all` でまとめ、`render()` の返り値もそれを返す)。
- `krokiEnabled` が false のときは何もしない(コードブロックのまま表示)。
  設定への導線として、図ブロックの直下に控えめな1行
  (「リモートレンダリングは設定で有効化できます」)を出すかは実装時の
  見た目で判断する(出すなら CSS は `.kroki-hint`)。

### テーマ・印刷

- Kroki が返す SVG は白背景前提の配色(テーマ非依存)なので、mermaid のような
  再レンダリングは**不要**。`.kroki-diagram` コンテナをライト背景固定にして
  ダークテーマでも図が読めるようにする(画像の扱いと同じ)。
- 印刷/PDF: ライト固定なのでそのまま印刷できる。mermaid のような
  印刷前再レンダリングも不要。`break-inside: avoid` だけ足す。

### HTML エクスポートへの焼き込み

- `bakeKrokiIntoStandaloneHtml(html): Promise<string>` を ui/kroki.ts に追加:
  M11 の `bakeMermaidIntoStandaloneHtml` と同じく DOMParser → renderKrokiBlocks →
  直列化。data URI `<img>` なのでエクスポート HTML はオフラインで表示できる。
- `krokiEnabled` が false のとき、またはリクエストが失敗したブロックは
  コードブロックのまま出力する(エクスポートのために勝手に送信しない)。
- エクスポートを sanitize しない方針は維持(挿入物が data URI `<img>` なので
  新たな懸念もない)。

### サンプル文書(sample/07-diagrams.adoc 追記)

- PlantUML: シーケンス図・クラス図あたりを 2〜3 例(`[plantuml]` と
  `[source,plantuml]` の両記法)。
- Draw.io: 最小の `mxfile` XML を1例 + 「kroki.io では現在停止中のことがあり、
  その場合はエラー表示になる。self-host では動く」という実挙動どおりの説明。
- 「この節の図はリモートレンダリング(設定でオプトイン)が必要」
  「図のソースが設定先サーバーへ送信される」ことを冒頭に明記。
- エラー表示確認用の誤り例を1つ入れる(M11 の流儀)。

## 設計判断まとめ

1. **通信は tauri-plugin-http 経由** — 静的 CSP では self-host URL を許可できない。
   ブラウザプレビューは window.fetch フォールバック
2. **POST 方式(text/plain → SVG)** — GET の deflate+base64url エンコードは
   依存や複雑さの割に利点がない。実測で 200 を確認済み
3. **挿入は `<img>` data URI(inline SVG にしない)** — 外部由来 SVG の
   スクリプト実行を構造的に封じ、Draw.io の `foreignObject` ラベルとも両立する。
   mermaid と方式が分かれるのは信頼境界の違いによる意図的な差
4. **オプトイン既定 OFF + サーバー URL 設定** — 文書内容の外部送信を伴うため
   (roadmap の設計論点どおり)
5. **Draw.io はベストエフォート** — kroki.io の diagramsnet コンパニオンが
   停止中であることを実測で確認。実装経路は共通なので含めるが、
   公開インスタンスでの動作は保証しない(エラー表示で伝わる設計にする)
6. **エラー時はコードブロック温存 + エラー表示 / 図はソース単位でキャッシュ** —
   M11 で確立した型の踏襲

## モジュール構成(差分)

```
src/
  core/settings.ts        krokiEnabled / krokiServerUrl(+ settings.test.ts)
  core/kroki.ts           新規: 種別解決・URL 構築・キャッシュキー・data URI 化
  core/kroki.test.ts      新規: 上記の仕様
  ui/kroki.ts             新規: fetch + <img> 差し替え + エクスポート焼き込み
  ui/preview.ts           decorateKroki 追加・アンカー再構築の一本化
  ui/settings-dialog.ts   作図セクション追加
  render.ts               [plantuml] / [drawio] 正規化拡張(テスト追加)
  main.ts                 配線: kroki プロバイダ・エクスポート焼き込み
src/styles.css            .kroki-diagram(ライト背景固定)+ ローディング/エラー表示
sample/07-diagrams.adoc   PlantUML / Draw.io 節を追記
src-tauri/Cargo.toml      tauri-plugin-http
src-tauri/src/lib.rs      プラグイン登録
src-tauri/capabilities/default.json  http 許可 + scope(識別子は実物確認)
package.json              @tauri-apps/plugin-http
```

## 実施順序(1機能 = 1コミット、ブランチ: feature/milestone-12-kroki)

1. `core/settings.ts` — テストファーストで krokiEnabled / krokiServerUrl
2. render.ts の `[plantuml]` / `[drawio]` 正規化拡張(特性化テスト付き)
3. `core/kroki.ts` — テストファーストで純粋ロジック一式
4. tauri-plugin-http 導入(Cargo + capability + lib.rs。識別子・scope 書式の
   実物確認込み)
5. `ui/kroki.ts` + preview 組み込み + CSS(オプトイン有効時に図が出る状態)
6. 設定ダイアログの作図セクション(+ main.ts 配線)
7. HTML エクスポート焼き込み
8. サンプル文書追記
9. `verify-tauri` チェックリストに M12 項目を追加

## 検証

- `npm test` / `npm run build`
- ブラウザプレビューでスモークテスト(**ネットワーク到達が前提**。kroki.io を使う):
  - オプトイン OFF(既定)で**リクエストが一切飛ばない**こと(Network タブで確認)
  - ON にすると `[plantuml]` / `[source,plantuml]` で図が出る
  - 同一図の再描画(入力デバウンス)でリクエストが再送されない(キャッシュ)
  - PlantUML 構文エラーで 400 の本文がエラー表示され、プレビューは壊れない
  - `[drawio]` は kroki.io では 503 → 「接続できません」系表示になる
    (オフラインフォールバック経路の確認を兼ねる)
  - サーバー URL に到達不能な値(例 `https://localhost:9`)を設定 →
    タイムアウト/接続エラー表示
  - ダークテーマで図が読める(ライト背景コンテナ)
  - 図を含む文書でスクロール同期がずれない(アンカー再構築)
- Tauri 実機確認(`verify-tauri` スキルに追記):
  - plugin-http 経由で図が出る(CSP を変更していないのに通ることの確認)
  - 設定の永続化(krokiEnabled / krokiServerUrl が再起動後も残る)
  - エクスポートした HTML をオフラインで開き、焼き込んだ図が表示される
  - オプトイン OFF でエクスポートしてもリクエストが飛ばず、コードブロックのまま

## 実装前にユーザーと擦り合わせる論点

1. **Draw.io をベストエフォートで含める**(推奨)か、kroki.io 復旧まで M13 送りにするか
2. 図の挿入方式を `<img>` data URI とすること(図内テキストの選択・コピーは
   できなくなる)への同意
3. オプトイン OFF 時に図ブロックへ設定導線のヒントを出すかどうか
   (実装時の見た目次第でよければ実装者判断)
