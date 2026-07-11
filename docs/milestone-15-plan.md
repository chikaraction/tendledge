# Milestone 15: セキュリティ強化

WebView は第三者の `.adoc`(保管庫のファイル)を開く。DOMPurify(`sanitizePreviewHtml`)が
突破された場合の被害範囲を狭めることが目的。roadmap.md の M15 節がスコープ定義、
本書はその設計文書。3項目とも「設定変更 + 実機確認」で、コード変更は伴わない項目もある。

## スコープ(3項目)

| # | 項目 | 種別 | 主な変更場所 |
|---|------|------|--------------|
| 1 | `withGlobalTauri: false` へ変更 | 攻撃面縮小 | tauri.conf.json |
| 2 | `fs:scope` の縮小検討 | 判断の記録 | capabilities/default.json(変更なしの可能性) |
| 3 | CSP・`assetProtocol.scope` の再点検 | 判断の記録 | tauri.conf.json(変更なしの可能性) |

## 1. `withGlobalTauri: false` へ変更

**現状**: `tauri.conf.json` の `app.withGlobalTauri` が `true`。これは `window.__TAURI__`
をフロントエンドのグローバルスコープに公開する設定で、XSS が成立した場合に攻撃者の
インラインスクリプトから直接 Tauri API を叩けてしまう(CSP の `script-src 'self'` は
`<script>` 注入を防ぐが、DOM 注入経由の `onerror` ハンドラ等の攻撃ベクタは別途あり得るため
多層防御として無効化する)。

`src/` 配下を `__TAURI__` で grep 済み — 0件。すべて `@tauri-apps/api/*` や
`@tauri-apps/plugin-*` の ES import 経由(バンドル時に解決される)なので、
`withGlobalTauri: false` にしてもフロントエンドの動作には影響しない。

**変更**: `app.withGlobalTauri` を `false` に変更。

**検証**: ビルド後の実機で全機能(ファイル I/O・保管庫・設定・エクスポート・図)が
従来通り動くことを確認する(`verify-tauri` チェックリスト一式)。ブラウザプレビューは
そもそも `isTauri()` が false の経路なので今回の変更の影響を受けない。

## 2. `fs:scope` の縮小検討 → 現状維持

**検討した縮小案**: ユーザープロファイル配下(`$HOME/**` 相当)への制限。

**判断: 現状維持(`["**"]`)。**

**理由**: 「フォルダを開く」(`main.ts` の `doOpenFolder`)はネイティブのディレクトリ
選択ダイアログ(`@tauri-apps/plugin-dialog` の `open({ directory: true })`)を使っており、
選択範囲はユーザープロファイル配下に限定されない(別ドライブ・外部メディア・
ネットワークドライブなど任意の場所を保管庫として開ける仕様)。単一ファイルを開く
`doOpen()` も同様に任意パスを許可するファイルダイアログ。

`fs:scope` をユーザープロファイル配下に絞ると、それ以外の場所にある保管庫・ファイルを
開いた瞬間に「forbidden path」エラーになり、既存の「どこでも保管庫にできる」という
仕様そのものを壊す(CLAUDE.md に記録済みの M13 の教訓: `fs:allow-*` だけではスコープが
空で、`fs:scope` が実際のアクセス可否を決めている)。ダイアログ選択パスは Tauri が
暗黙にスコープするため `fs:scope` を絞っても Ctrl+O 自体は動くが、保管庫サブフォルダの
`readTextFile`(こちらは `fs:scope` の明示許可に依存)が壊れる。

縮小の効果(XSS 時に読み書きできる範囲を狭める)よりも、機能破壊のリスクとユーザーの
期待仕様(任意の場所を保管庫にできる)を損なうコストの方が大きいと判断し、**変更しない**。
本書とこの判断でクローズする(roadmap.md 側は追記不要、backlog にも送らない)。

## 3. CSP・`assetProtocol.scope` の再点検 → 現状維持

### `assetProtocol.scope`

`resolveImagePath` → `convertFileSrc`(`main.ts`)で `image::` に書かれた画像を
`asset:` プロトコル URL に変換して表示している。画像パスは文書の `path` からの相対解決
であり、文書自体が任意の場所を開けるため(上記 1 と同じ理由)、画像も任意の場所を
参照しうる。`fs:scope` と同じ理由で `["**"]` を維持する。

### CSP

現行の CSP:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' asset: http://asset.localhost blob: data:; font-src 'self' data:;
connect-src 'self' ipc: http://ipc.localhost ws://localhost:1420
```

再点検した各ディレクティブ:

- `script-src 'self'`: インラインスクリプト不可・外部スクリプト不可で最も厳しい設定。
  変更不要。
- `style-src 'unsafe-inline'`: Asciidoctor.js / Mermaid / Kroki(SVG)が生成する
  インラインスタイル(`style="..."` 属性、`<style>` タグ)を許可するために必要。
  外す場合は生成 HTML の style 属性を全除去する改修が要るが、レンダリング品質の
  劣化(mermaid のテーマ配色は SVG 内の inline style に依存)と釣り合わないため維持。
- `img-src`: `asset:` / `http://asset.localhost` は画像表示に必須(上記参照)。
  `blob:` / `data:` は Kroki の data URI 化(`svgToDataUri`)と Mermaid の描画に必須。
- `connect-src ws://localhost:1420`: Vite の HMR(dev サーバー)専用。`tauri.conf.json` は
  dev/build で単一ファイルのため、リリースビルドにもこの許可が残る。ただし
  `localhost:1420` への WebSocket 接続はローカルホスト上で該当ポートを listen する
  プロセスが必要で、リモート攻撃者が外部からこの許可を悪用する経路はない
  (被害があるとすれば同一マシン上の別プロセスによるローカル攻撃で、CSP より前段の
  脅威モデルの話になる)。dev/build 設定分離は Tauri 標準の仕組みでは自動化されておらず、
  `--config` オーバーライドを自前で組む必要があり、この程度の残存リスクに対して
  導入コストが見合わない。**変更しない。**
- Kroki の通信(`ui/kroki.ts`)は `tauri-plugin-http` 経由で Rust 側から行われるため
  CSP の対象外(`connect-src` に kroki サーバーの URL を足す必要はない)。
  許可範囲は capability の `http:default`(`allow: ["http://*:*", "https://*:*"]`)が
  受け持っており、これは今回のスコープ外(サーバー URL がユーザー設定値である以上、
  ホスト制限は現実的でない)。

**判断: CSP・`assetProtocol.scope` はいずれも変更しない。** 本書の記録をもって
roadmap.md の当該項目をクローズする。

## 実施順序

1〜3 は独立(互いに依存しない)。1 のみ実コード変更を伴うため先に着手し、
2・3 は判断の記録(本書)自体が成果物なので、本書のレビュー・合意をもって完了とする。

## 検証

- 1(`withGlobalTauri: false`)は `verify-tauri` チェックリストで実機の全機能を確認。
- 2・3 は設計判断のみのため、`npm test` / `npm run build` の通常回帰確認のみで足りる
  (挙動変更なし)。

## コミット方針

roadmap の3項目のうち実コード変更があるのは1のみ。1 を1コミット、2・3 の判断記録は
本設計文書のコミット(または1と同一コミット)で足りる——別々の「機能」ではなく
1つのマイルストーンの完了記録のため、milestone スキルの「機能単位コミット」は
「1: 設定変更」を1コミットとして扱う。
