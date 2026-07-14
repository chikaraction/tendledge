[English](README.md) | [日本語](README.ja.md)

# Tendledge

リアルタイムプレビュー付きのデスクトップ AsciiDoc エディタ
(Tauri v2 + CodeMirror 6 + Asciidoctor.js)。
デザインは Slate(ダークファースト + 紫アクセント、[docs/design-direction.md](docs/design-direction.md))。

## 主な機能

- 左右分割レイアウト(ディバイダをドラッグしてリサイズ可能)+
  表示モード切替(エディタのみ / 分割 / プレビューのみ。Ctrl+K V / Ctrl+Shift+V)
- CodeMirror 6 エディタ + AsciiDoc ハイライト(表セル、インラインマクロ、
  ブロックのネストに対応)
- Asciidoctor.js によるデバウンス付きリアルタイム変換(デバウンス時間は設定で変更可)
- エディタとプレビューのスクロール同期(見出し単位でペアリングし、見出し間は補間)
- プレビューのコードブロックのシンタックスハイライト(highlight.js。
  HTML エクスポートには静的に焼き込み)
- **作図**: Mermaid(ビルトイン)、PlantUML / Draw.io(Kroki 経由。既定はオフ。
  有効化すると図のソースが Kroki サーバーへ送信される点に注意)
- **タブ**: 複数ドキュメントの同時オープン(Ctrl+W で閉じる、Ctrl+Tab で切替。
  undo 履歴・カーソル位置・スクロール位置はタブごとに保持)
- **保管庫**: フォルダを開いてサイドバーのファイルツリーから編集対象を選択
  (対応拡張子: adoc / asciidoc / asc / txt。サイドバーの幅もドラッグで変更可能)
- **設定画面**: テーマ(ライト / ダーク / OS 追従)・エディタのフォントサイズ・
  プレビューのデバウンス・Kroki の有効化を変更でき、`tauri-plugin-store` で永続化
- HTML エクスポート(スタンドアロン 1 ファイル、図とハイライトを焼き込み)、
  PDF / 印刷(`window.print()`、OS の印刷ダイアログ経由)
- **アプリ内ヘルプ**(F1 またはメニュー「ヘルプ」): ショートカット一覧と
  対応状況・注意点を、読み取り専用のプレビュータブで表示
- カスタムメニューバーとステータスバー(行・列 / 文字数 / 変換時間)、
  ウィンドウ位置・サイズの復元
- プレビューは DOMPurify でサニタイズ(保管庫で第三者のファイルを開いても
  スクリプトを実行させない)+ CSP 設定済み
- UI アイコンは [Lucide](https://lucide.dev/)(ISC ライセンス)
- Vitest によるユニットテスト(`npm test`。純粋ロジックは `src/core/` に分離)

## 前提

- Node.js 18 以上
- Rust ツールチェーン(https://rustup.rs)
- Windows の場合: WebView2 ランタイム(Windows 10/11 は標準搭載)

## セットアップ手順

```sh
# 1. リポジトリを clone
git clone https://github.com/chikaraction/tendledge.git
cd tendledge

# 2. 依存関係をインストール
npm install

# 3. 開発モードで起動
npm run tauri dev
```

初回は Rust のコンパイルが走るため数分かかります。2 回目以降は高速です。
配布用ビルドは `npm run tauri build`(`src-tauri/target/release/bundle/` に
インストーラが生成されます)。

## 構成

| ファイル | 役割 |
| --- | --- |
| `src/main.ts` | 合成ルート(DOM 取得と各モジュールの接続、ファイル I/O・保管庫・設定の配線) |
| `src/core/` | 純粋ロジック(タブ状態、ツリー構築、スクロール補間、設定スキーマ、表示モード等)。テストは同ディレクトリに併置 |
| `src/ui/` | DOM 接続層(エディタ、プレビュー、タブバー、ファイルツリー、メニューバー、設定ダイアログ等) |
| `src/render.ts` | Asciidoctor.js 変換 + DOMPurify サニタイズ |
| `src/asciidoc-mode.ts` | AsciiDoc ハイライト(StreamLanguage、ブロックスタックでネスト対応) |
| `src/help-doc.ts` | アプリ内ヘルプの本文(AsciiDoc) |
| `src/styles.css` | レイアウトとプレビューのスタイル、テーマ変数、印刷用 `@media print` |
| `index.html` | メニューバー + タブバー + サイドバー + 2 ペイン + ステータスバーの骨格 |
| `sample/` | 記法ごとのサンプル文書(「フォルダを開く」で保管庫として開ける) |
| `docs/` | 設計文書([design-direction.md](docs/design-direction.md)、[roadmap.md](docs/roadmap.md)、[backlog.md](docs/backlog.md)、各マイルストーンの `milestone-N-plan.md`) |

## メモ

- `include::` ディレクティブは未対応です(アプリ内蔵の Asciidoctor.js が変換中に
  ローカルファイルを読み込めないため)。既知の制限はアプリ内ヘルプ(F1)にも
  まとめています。
- ステータスバー右端の数字は変換にかかった時間(ms)です。
- PDF出力はアプリ内 `window.print()` から OS の印刷ダイアログ(「PDFとして保存」)
  を使う方式です。Windows(WebView2)では動作確認済みですが、macOS/Linux の
  WebKit系バックエンドでは印刷ダイアログの挙動が不安定な既知の問題があります。
- スクロール同期は見出し行とプレビューの見出し要素を出現順でペアリングし、
  見出し間は線形補間しています。見出しの少ない長いブロック内では同期の
  粒度が粗くなります。

## ライセンス

MIT ライセンスです。全文は [LICENSE](LICENSE) を参照してください。
