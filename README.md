# AsciiDoc Editor (Tauri + CodeMirror 6 + Asciidoctor.js)

リアルタイムプレビュー付き AsciiDoc エディタ(マイルストーン 1〜5、ロードマップ完了)。

- 左右分割レイアウト(ディバイダをドラッグしてリサイズ可能)
- CodeMirror 6 エディタ + AsciiDoc ハイライト(表セル、インラインマクロ、
  ブロックのネストに対応)
- Asciidoctor.js による 300ms デバウンス付きリアルタイム変換
- ライト / ダークモード自動対応
- ファイルの新規 / 開く / 保存 / 名前を付けて保存(`@tauri-apps/plugin-fs` +
  `plugin-dialog`、キーボードショートカット Ctrl+N/O/S/Shift+S 対応)
- エディタとプレビューのスクロール同期(見出し単位でペアリングし、見出し間は補間)
- HTML エクスポート、PDF / 印刷(`window.print()`、OS の印刷ダイアログ経由)

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
| `src/main.ts` | エディタ生成、デバウンス付き変換、ペインリサイズ、ファイルI/O、スクロール同期、エクスポート |
| `src/asciidoc-mode.ts` | AsciiDoc ハイライト(StreamLanguage、ブロックスタックでネスト対応) |
| `src/styles.css` | レイアウトとプレビューのスタイル、印刷用 `@media print` |
| `index.html` | 2 ペイン + ツールバーの骨格 |

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
