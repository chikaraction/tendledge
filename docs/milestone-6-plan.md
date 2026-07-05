# Milestone 6: 保管庫・タブ・設定画面

## 目標

Obsidian のように「フォルダ(保管庫)を開いて複数ファイルを行き来しながら編集する」体験に近づける。
プラグイン機構は対象外。機能は今後も漸進的に追加する前提で、拡張しやすいモジュール構成に改める。

## スコープ

1. **テスト基盤(Vitest)** — t-wada 流の開発スタイルを可能にする
   - 既存ロジックは特性化テストで現在の挙動を固定してから移動する
   - 新規ロジック(ドキュメント状態・ツリー構築・設定)はテストファーストで書く
   - テストは仕様書を兼ねる: `describe`/`it` は日本語で振る舞いを記述する
2. **main.ts のモジュール分割** — 純粋ロジック(`core/`)と DOM 接続(`ui/`)の分離
3. **XSS 対策** — 保管庫で第三者のファイルを開く前提になるため
   - プレビュー HTML を DOMPurify でサニタイズ(AsciiDoc のパススルーブロックは
     `safe: "safe"` でも生 HTML を素通しするため必須)
   - `tauri.conf.json` に CSP を設定(現状 `null`)
   - HTML エクスポートはサニタイズしない(自分の文書の意図的なパススルーを壊さない。
     攻撃面は Tauri API ブリッジを持つ WebView のみ)
4. **タブ** — 複数ドキュメントの同時オープン
5. **保管庫** — フォルダを開いてファイルツリーから編集対象を選ぶ
6. **設定画面** — tauri-plugin-store で永続化

## モジュール構成(リファクタ後)

```
src/
  main.ts              合成ルート(DOM 取得と各モジュールの接続のみ)
  render.ts            Asciidoctor 変換 + DOMPurify サニタイズ
  asciidoc-mode.ts     (既存のまま)
  core/                純粋ロジック。DOM / Tauri に依存しない = Vitest で直接テスト可能
    paths.ts           basename / suggestedExportName
    headings.ts        見出し行の抽出(/^=+\s/)
    scroll-sync.ts     アンカー線形補間の計算(DOM 要素ではなくオフセット数値を受ける)
    documents.ts       タブ = ドキュメントの状態管理(開く/閉じる/切替/dirty 判定)
    vault-tree.ts      readDir 結果 → ツリーモデル(ソート: フォルダ優先 → 名前順)
    settings.ts        設定スキーマ・デフォルト値・保存値とのマージ
  ui/                  DOM 接続層(薄く保つ。ロジックは core/ に寄せる)
    editor.ts          CodeMirror 生成、タブ切替時の EditorState 差し替え
    preview.ts         プレビュー描画・スクロール同期の DOM 側
    tabs.ts            タブバー
    file-tree.ts       サイドバーのファイルツリー
    settings-dialog.ts 設定モーダル
    divider.ts         ペインリサイズ
    shortcuts.ts       キーボードショートカット
tests/                 core/ に 1:1 対応
```

設計原則: **DOM・Tauri API に触るコードと計算を分離する**。
例: スクロール同期の補間計算は現在 DOM 要素(`previewOffsetOf`)に依存しているが、
「アンカー = {lineno, offset} の配列」を引数に取る純粋関数に変え、DOM 測定は ui 側で行う。

## 各機能の設計

### タブ(core/documents.ts + ui/tabs.ts)

- ドキュメント = `{ id, path?, lastSavedContent }` + CodeMirror の `EditorState`(undo 履歴ごと保持)
- dirty 判定は従来通り `現在の doc !== lastSavedContent`(タブごと)
- 同じ path を二重に開いたら既存タブをアクティブ化
- dirty なタブを閉じるときは確認ダイアログ
- ショートカット: Ctrl+W(閉じる)、Ctrl+Tab(次のタブ)
- Untitled タブを許容(新規作成)。既存の New/Open/Save はタブ単位の操作になる

### 保管庫(core/vault-tree.ts + ui/file-tree.ts)

- ツールバーに「フォルダを開く」を追加 → `dialog.open({ directory: true })`
- `plugin-fs` の `readDir` で走査(手動再帰。`.git` などドット始まりは除外)
- 表示対象: `.adoc` / `.asciidoc` / `.asc` / `.txt`(フォルダは中身があれば表示)
- サイドバー(左端、トグル可)にツリー表示。クリックでタブに開く
- ファイル監視(watch)は今回のスコープ外(将来の追加候補)
- 追加パーミッション: `fs:allow-read-dir`(識別子はインストール済み crate の
  `permissions/` で要確認 — CLAUDE.md の方針通り推測しない)

### 設定画面(core/settings.ts + ui/settings-dialog.ts)

- 項目(初期セット。今後追加しやすいようスキーマ + デフォルト値方式):
  - テーマ: `light | dark | system`
  - エディタのフォントサイズ(px)
  - プレビューのデバウンス(ms)
- 永続化: `tauri-plugin-store`(AppConfig ディレクトリの `settings.json`)
  - Cargo.toml への依存追加 + capability へのパーミッション追加の両方が必要
- UI はモーダルダイアログ。ツールバーに歯車ボタン

### XSS 対策

- `render.ts` で `DOMPurify.sanitize()` を通してから `innerHTML` へ
- CSP 例(実機確認しながら調整): `script-src 'self'` を核に、
  Vite dev の HMR(ws)と Asciidoctor 出力のインラインスタイルを許容する構成

## 実施順序と分担

| # | 作業 | 担当 |
|---|---|---|
| 1 | Vitest 導入 + 既存純粋ロジックの特性化テスト | Fable |
| 2 | main.ts 分割リファクタ(挙動変更なし、テストで担保) | Fable |
| 3 | XSS 対策(DOMPurify + CSP) | Fable |
| 4 | タブ(documents.ts テストファースト → UI) | Fable |
| 5 | 保管庫(vault-tree.ts テストファースト → UI) | Fable |
| 6 | 設定画面(スキーマ + Store + UI) | Sonnet サブエージェントに委譲、Fable がレビュー |
| 7 | 統合検証(ブラウザプレビュー + `npm run tauri dev` での実機確認) | Fable |

3〜5 は 2 に依存。6 は 2 完了後なら並行可能。

## 検証方法

- `npx vitest run` — core/ のユニットテスト
- `npm run build` — tsc 型チェック + Vite ビルド
- ブラウザプレビュー(Vite のみ)— UI レイアウト・タブ操作の確認
  (Tauri API を使う機能 = ファイル I/O・保管庫はブラウザでは動かない点に注意)
- `npm run tauri dev` — 保管庫・設定永続化・CSP の実機確認(最終確認はユーザー)
