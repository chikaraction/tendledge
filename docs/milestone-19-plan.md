# Milestone 19: リブランディングと配布準備

roadmap.md の M19 節がスコープ定義、本書はその設計文書。
アプリ名は **tendledge**(表示名 Tendledge / 識別子は全小文字)に決定済み。
ブランチは `feature/milestone-19`。

計画時にユーザーと擦り合わせて確定した事項(2026-07-13):

- バンドル識別子は `io.github.chikaraction.tendledge`(独自ドメイン不要の逆 DNS)
- アイコンの元画像は Claude が SVG 案を数案作成し、ユーザーが選定
- README 英語化(英語 README.md + 日本語 README.ja.md)を本マイルストーンに含める
  (バックログから昇格 — 名称反映で README を触るのと同時期が二度手間なし)
- ヘルプページは**専用ダイアログではなくタブで開く**(AsciiDoc 文書として
  既存のプレビュー機構をそのまま使う。新 UI 不要、`:toc:` で目次も付く)

## スコープ

| # | 項目 | 主な変更場所 |
|---|------|--------------|
| 1 | 名称の反映(コード・設定・サンプル) | tauri.conf.json, package.json, Cargo.toml, main.rs, index.html, sample/*.adoc, CLAUDE.md |
| 2 | README リブランディング+英語化 | README.md(英語・新規), README.ja.md(現行を移動) |
| 3 | ヘルプ: 重複オープン防止の core ロジック(テストファースト) | core/documents.ts + テスト |
| 4 | ヘルプ: 本文とメニュー配線 | src/help-doc.ts(新規), main.ts, ui/shortcuts.ts |
| 5 | アプリアイコン | src-tauri/icons/(全置換)+ 元 SVG |
| 6 | リリースビルド確認+ドキュメント更新 | verify-tauri スキル, roadmap.md, backlog.md |
| — | GitHub リポジトリ名変更(ユーザー操作) | GitHub 設定 + ローカル remote URL |

**スコープ外**: バージョン番号は 0.1.0 のまま(初回配布時に改めて判断)。
「Tendledge について」ダイアログ(バージョン表示)は今回は作らない。
ローカルフォルダ名 `AsciiDoc-editor` の変更は任意の別作業
(Claude Code のプロジェクト記憶・セッションがパスに紐づくため、
やるならマイルストーン完了後にセッションを区切ってから)。

## 1. 名称の反映

現状の `asciidoc-editor` / `AsciiDoc Editor` の出現箇所(node_modules 等を除き
grep で全数確認済み)を以下のとおり置き換える:

- **src-tauri/tauri.conf.json**: `productName: "Tendledge"`(バイナリ名・
  インストーラ名になる)/ `identifier: "io.github.chikaraction.tendledge"` /
  ウィンドウ `title: "Tendledge"`
- **package.json**: `name: "tendledge"` → `npm install` で package-lock.json を同期
- **src-tauri/Cargo.toml**: `name = "tendledge"`、`[lib] name = "tendledge_lib"`、
  `description` / `authors` のテンプレート値(`"A Tauri App"` / `"you"`)も整える
- **src-tauri/src/main.rs**: `tendledge_lib::run()` へ追随
- **src-tauri/Cargo.lock**: パッケージ名変更の反映(`cargo metadata` 等で
  ロックファイルだけ更新し、同一コミットに含める。フルビルド不要)
- **index.html**: `<title>Tendledge</title>`
- **sample/*.adoc**: `:author: AsciiDoc Editor` / `:product-name:` /
  03-blocks.adoc の JSON 例 → `Tendledge`
- **CLAUDE.md**: プロジェクト説明にアプリ名を1行追記

### identifier 変更の影響(設計時に確認済み)

`tauri-plugin-store`(settings.json)と `tauri-plugin-window-state` の保存先は
identifier 由来のアプリデータディレクトリ(Windows は
`%APPDATA%\<identifier>`)。変更すると**旧設定は引き継がれない**が、
配布前なので移行処理は作らない(開発機の旧
`com.example.asciidoc-editor` ディレクトリは手動削除してよい)。
verify-tauri に「設定が新 identifier のディレクトリへ保存される」確認を追記する。

## 2. README リブランディング+英語化

- 現行 README.md を **README.ja.md** へ移動し、名称を Tendledge に更新。
  クイックスタートの `npm create tauri-app@latest asciidoc-editor` の下りは
  「リポジトリを clone する」手順(新リポジトリ名 `tendledge`)に書き換える。
- **README.md** は英語で新規作成(内容は日本語版と同構成)。
- 両ファイル冒頭に相互リンク: `[English](README.md) | [日本語](README.ja.md)`

## 3. ヘルプ: core/documents.ts — 重複オープン防止(テストファースト)

ヘルプはファイルに紐づかない組み込み文書なので、`openFile` の
「同じ path なら既存タブをアクティブ化」に相当する仕掛けを `kind` マーカーで作る:

```ts
export interface DocumentInfo {
  // 既存フィールドに加えて
  /** "help" = 組み込みヘルプ文書(重複オープン防止・ラベル固定) */
  readonly kind?: "help";
}

export interface DocumentStore {
  // 既存メソッドに加えて
  /** ヘルプ文書をタブとして開く。既に開いていれば既存タブをアクティブ化する */
  openHelp(content: string): OpenFileResult;
}
```

`documentLabel` は `kind === "help"` のとき `"ヘルプ"` を返す。
`core/documents.test.ts` に先に仕様を書く:

- ヘルプを開くと新規タブが末尾に追加されアクティブになる。ラベルは「ヘルプ」
- 開いた直後は dirty でない(サンプル文書と同じ保存済み扱い)
- 既にヘルプタブがあれば新規タブは作らず既存をアクティブ化する(`alreadyOpen: true`)
- 編集済みのヘルプタブを再オープンしても内容はリセットされない
- ヘルプタブを閉じた後は再度開ける(新規タブとして)

編集・保存・Ctrl+W の挙動は既存のままでよい(編集すれば dirty になり、
保存は path が無いので「名前を付けて保存」へ流れる — 特別扱いしない)。

## 4. ヘルプ: 本文とメニュー配線

### src/help-doc.ts(新規)

`sample-doc.ts` と同じ方式で `export const helpDoc` の AsciiDoc 文字列。
冒頭に `:toc:`(既存の目次スタイルが効く)。構成は roadmap の案のとおり:

1. **ショートカット一覧** — Ctrl+N / O / S / Shift+S / P / W / Tab /
   Ctrl+K V(分割) / Ctrl+Shift+V(プレビューのみ) / Ctrl+F / F1(本ヘルプ)、
   basicSetup 由来のエディタ操作(Ctrl+Z・Ctrl+Y、Tab/Shift+Tab のインデント、
   検索パネル内の置換)。注記: Ctrl+K V は Ctrl+K の後 1.5 秒以内、
   Ctrl+F はプレビューのみ表示中はネイティブ検索になる
2. **AsciiDoc 対応状況** — `include::` 非対応(対応検討は backlog)、
   文書間リンクは `xref:` 推奨(`link:*.adoc` は HTML/PDF エクスポートで
   `.adoc` のまま残る)、パススルー(`++++`)はプレビューでは
   サニタイズされるが HTML エクスポートには残る挙動差
3. **図** — Mermaid / PlantUML / Draw.io の書き方の最小例。
   **Kroki 有効化時は文書内容が外部サーバへ送信される**注意(優先度高)
4. **エクスポート/印刷** — ライト配色固定は仕様、macOS/Linux の
   印刷ダイアログ不安定
5. **保管庫** — 対応拡張子のみ表示・ドットファイルと空フォルダ非表示・
   ファイル監視なし(↻ で手動更新)
6. **タブと未保存データ** — Ctrl+W 時の確認とウィンドウ ✕ ボタンの挙動

### メニュー・ショートカット(main.ts / ui/shortcuts.ts)

- メニューバー末尾にトップレベル「ヘルプ」メニューを追加し、
  項目「ヘルプを開く」(F1)から `store.openHelp(helpDoc)` →
  既存の openFile と同じタブ生成/アクティブ化フローに乗せる。
- `ui/shortcuts.ts` に F1 を追加。
- 表示モードは触らない(分割ならプレビュー側で読める。プレビューのみへの
  自動切替は、モードがウィンドウグローバルでヘルプを閉じた後も残るため見送り)。

## 5. アプリアイコン

1. Slate トーン(ダーク地 + 紫アクセント、design-direction.md 準拠)の
   SVG 案を数案作成し、ユーザーに提示して選定してもらう
   (ブラウザペインはスクリーンショット不可のため、SVG ファイルを直接送って
   レンダリング表示してもらう)。
2. 採用案を `src-tauri/icons/source.svg` としてコミット。
3. `npm run tauri icon <path>` で `src-tauri/icons/` の全プラットフォーム分
   (.ico / .icns / PNG 各種)を再生成。Tauri v2 CLI は SVG 入力を受け付ける
   はずだが `-- --help` で実物確認し、PNG 必須なら 1024×1024 に
   ラスタライズしてから渡す(一時スクリプト。リポジトリには残さない)。

## 6. リリースビルド確認+ドキュメント更新

- `npm run tauri build` を通し、生成物(インストーラ/実行ファイル名が
  Tendledge になっていること)を確認。実機起動確認はユーザーに依頼。
- **verify-tauri スキル**に追記: ウィンドウタイトル・タスクバー/エクスプローラーの
  アイコンが Tendledge になっている / 設定変更が
  `%APPDATA%\io.github.chikaraction.tendledge` に保存される /
  ヘルプメニュー(F1)でヘルプタブが開き、二度目は既存タブへフォーカスする
- **roadmap.md**: M19 を実装済みへ移動。**backlog.md**: README 英語化の項を消す。

## GitHub リポジトリ名変更(ユーザー操作)

- GitHub の Settings でリポジトリ名を `AsciiDoc-editor` → `tendledge` へ変更
  (旧 URL は GitHub が自動リダイレクトするためタイミングは自由。
  混乱を避けるなら本マイルストーンの PR マージ後を推奨)。
- 変更後にローカルで `git remote set-url origin <新URL>` を実行(こちらで代行可)。

## 実施順序(1項目 = 1コミット)

1. 設計文書(本書)のコミット
2. 項目1: 名称の反映
3. 項目2: README リブランディング+英語化
4. 項目3: core/documents.ts の openHelp(テストファースト)
5. 項目4: help-doc.ts 本文+メニュー/ショートカット配線
6. 項目5: アイコン(SVG 案の選定はユーザーとの対話を挟む)
7. 項目6: リリースビルド確認+verify-tauri / roadmap / backlog 更新

## 検証

- `npm test`(documents の新規仕様含む)と `npm run build` を通す。
- ブラウザプレビュー(**ポート 1421** — 1420 は tauri dev 用に空けておく)で
  スモーク: ヘルプメニュー → タブが開く → 目次が付く → 再度開くと
  既存タブへフォーカス(テキスト系ツールで確認)。
- 名称・アイコン・設定保存先・リリースビルドは Tauri 実機依存なので、
  verify-tauri の追記項目をユーザーに提示して実機確認してもらう。

## 追記(2026-07-14): ヘルプのプレビュー固定と編集不可

実装後のフィードバックで「ヘルプは必ずプレビューで開き、編集不可にする」へ変更し、
項目4の「表示モードは触らない」判断を撤回した:

- `core/view-mode.ts` に `enterHelpMode` / `leaveHelpMode`(テスト付き)。
  ヘルプタブへ入るときプレビューのみへ強制し、離れるとき直前の編集モードへ
  復元する。ヘルプ表示中に手動でモードを変えた場合は復元で上書きしない。
- ヘルプタブの EditorState は読み取り専用(`ui/editor.ts` の `newState` に
  readOnly オプション。`EditorState.readOnly` + `EditorView.editable: false`)。
- 「名前を付けて保存」でファイルへ昇格したら(core 側で kind が外れるのに合わせ)
  編集可能な EditorState へ差し替え、モード固定も解除する。
- 追加のフィードバックで「画面操作ではプレビューのみから一切動かせない」へさらに強化。
  表示メニュー・Ctrl+K V / Ctrl+Shift+V・タブバー右上の切り替えボタンをまとめて
  無効化する `applyViewModeFromUser` ガードを main.ts に置き、ヘルプ表示中はボタン自体を
  hidden にする(`docs/roadmap.md` 整理と合わせて2件フォローアップとして実施)。

## 分担の指針

- 項目1〜4 は仕様が明確なので Sonnet サブエージェントへ委譲可
  (milestone スキル手順 3〜6 を指示に含め、成果物はメイン側でレビュー)。
- 項目5(アイコン選定)と項目6(ビルド確認)はユーザーとの対話・実機が
  絡むためメインセッションで行う。
