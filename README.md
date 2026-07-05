# AsciiDoc Editor (Tauri + CodeMirror 6 + Asciidoctor.js)

リアルタイムプレビュー付き AsciiDoc エディタ(マイルストーン 1〜6 実装済み)。

- 左右分割レイアウト(ディバイダをドラッグしてリサイズ可能)
- CodeMirror 6 エディタ + AsciiDoc ハイライト(表セル、インラインマクロ、
  ブロックのネストに対応)
- Asciidoctor.js によるデバウンス付きリアルタイム変換(デバウンス時間は設定で変更可)
- ライト / ダークモード(設定で固定も、OS 追従も可能)
- ファイルの新規 / 開く / 保存 / 名前を付けて保存(`@tauri-apps/plugin-fs` +
  `plugin-dialog`、キーボードショートカット Ctrl+N/O/S/Shift+S 対応)
- **タブ**: 複数ドキュメントの同時オープン(Ctrl+W で閉じる、Ctrl+Tab で切替。
  undo 履歴・カーソル位置はタブごとに保持)
- **保管庫**: フォルダを開いてサイドバーのファイルツリーから編集対象を選択
  (対応拡張子: adoc / asciidoc / asc / txt)
- **設定画面**: テーマ・エディタのフォントサイズ・プレビューのデバウンスを
  変更でき、`tauri-plugin-store` で永続化
- エディタとプレビューのスクロール同期(見出し単位でペアリングし、見出し間は補間)
- HTML エクスポート、PDF / 印刷(`window.print()`、OS の印刷ダイアログ経由)
- プレビューは DOMPurify でサニタイズ(保管庫で第三者のファイルを開いても
  スクリプトを実行させない)+ CSP 設定済み
- Vitest によるユニットテスト(`npm test`。純粋ロジックは `src/core/` に分離)

## 前提

- Node.js 18 以上
- Rust ツールチェーン(https://rustup.rs)
- Windows の場合: WebView2 ランタイム(Windows 10/11 は標準搭載)

## セットアップ手順

Tauri のネイティブ側(`src-tauri/`)はテンプレートから生成するのが確実です。

```sh
# 1. Tauri プロジェクトの雛形を作成
#    → フロントエンドは「TypeScript / Vanilla」+「Vite」を選択
npm create tauri-app@latest asciidoc-editor

# 2. この一式のファイルを雛形に上書きコピー
#    (package.json, vite.config.ts, tsconfig.json, index.html, src/ を置き換え。
#     src-tauri/ はテンプレートのまま触らなくて OK)

# 3. 依存関係をインストール
cd asciidoc-editor
npm install

# 4. 開発モードで起動
npm run tauri dev
```

初回は Rust のコンパイルが走るため数分かかります。2 回目以降は高速です。

## 構成

| ファイル | 役割 |
| --- | --- |
| `src/main.ts` | 合成ルート(DOM 取得と各モジュールの接続、ファイル I/O・保管庫・設定の配線) |
| `src/core/` | 純粋ロジック(タブ状態、ツリー構築、スクロール補間、設定スキーマ等)。テストは同ディレクトリに併置 |
| `src/ui/` | DOM 接続層(エディタ、プレビュー、タブバー、ファイルツリー、設定ダイアログ等) |
| `src/render.ts` | Asciidoctor.js 変換 + DOMPurify サニタイズ |
| `src/asciidoc-mode.ts` | AsciiDoc ハイライト(StreamLanguage、ブロックスタックでネスト対応) |
| `src/styles.css` | レイアウトとプレビューのスタイル、テーマ変数、印刷用 `@media print` |
| `index.html` | ツールバー + タブバー + サイドバー + 2 ペインの骨格 |
| `docs/milestone-6-plan.md` | マイルストーン 6 の設計文書 |

## メモ

- 変換は `safe: "safe"` モードで実行しています。`include::` ディレクティブは
  このモードでは無効なため、使う場合は変換オプションの見直しが必要です。
- ツールバー右端の数字は変換にかかった時間(ms)です。
- PDF出力はアプリ内 `window.print()` から OS の印刷ダイアログ(「PDFとして保存」)
  を使う方式です。Windows(WebView2)では動作確認済みですが、macOS/Linux の
  WebKit系バックエンドでは印刷ダイアログの挙動が不安定な既知の問題があります。
- スクロール同期は見出し行とプレビューの見出し要素を出現順でペアリングし、
  見出し間は線形補間しています。見出しの少ない長いブロック内では同期の
  粒度が粗くなります。
