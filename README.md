# AsciiDoc Editor (Tauri + CodeMirror 6 + Asciidoctor.js)

リアルタイムプレビュー付き AsciiDoc エディタの最小構成(マイルストーン 1〜3)。

- 左右分割レイアウト(ディバイダをドラッグしてリサイズ可能)
- CodeMirror 6 エディタ + 簡易 AsciiDoc ハイライト
- Asciidoctor.js による 300ms デバウンス付きリアルタイム変換
- ライト / ダークモード自動対応

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
| `src/main.ts` | エディタ生成、デバウンス付き変換、ペインリサイズ |
| `src/asciidoc-mode.ts` | 簡易 AsciiDoc ハイライト(StreamLanguage) |
| `src/styles.css` | レイアウトとプレビューのスタイル |
| `index.html` | 2 ペインの骨格 |

## 次のマイルストーン

4. ハイライトの強化(テーブル内部、インラインマクロ、ネスト対応など)
5. ファイルの開く / 保存(`@tauri-apps/plugin-fs` + `plugin-dialog`)、
   スクロール同期、HTML / PDF エクスポート

## メモ

- 変換は `safe: "safe"` モードで実行しています。`include::` ディレクティブを
  使いたい場合はファイルシステム連携(マイルストーン 5)と合わせて要検討です。
- ツールバー右端の数字は変換にかかった時間(ms)です。
