# ロードマップ(Milestone 14 以降)

Milestone 1〜13 は実装済み。以降の計画を記す。
各マイルストーンの着手時には `milestone` スキルの手順に従い、
`docs/milestone-N-plan.md` の設計文書を別途起こすこと(本書はその上位のロードマップ)。
マイルストーンの積み残し・保留項目は本書ではなく [backlog.md](backlog.md) で管理する。

## 実装済みマイルストーン

- M1〜M7: エディタ/プレビュー、ペイン、ハイライト、ファイルI/O、スクロール同期、
  エクスポート、タブ、保管庫、設定、Slate UI
- M8: サンプル文書の整備([milestone-8-plan.md](milestone-8-plan.md))
- M9: ビューモード切り替え([milestone-9-plan.md](milestone-9-plan.md))
- M10: プレビューのシンタックスハイライト([milestone-10-plan.md](milestone-10-plan.md))
- M11: 作図① Mermaid([milestone-11-plan.md](milestone-11-plan.md))
- M12: 作図② PlantUML / Draw.io(Kroki 経由)([milestone-12-plan.md](milestone-12-plan.md))
- M13: バグ修正・使い勝手改善([milestone-13-plan.md](milestone-13-plan.md))
- M14: データ保護・堅牢性([milestone-14-plan.md](milestone-14-plan.md))
- M15: セキュリティ強化([milestone-15-plan.md](milestone-15-plan.md))
- M16: パフォーマンス改善([milestone-16-plan.md](milestone-16-plan.md))
- M17: テスト補強・小掃除([milestone-17-plan.md](milestone-17-plan.md))
- M18: サイドバーの幅リサイズ([milestone-18-plan.md](milestone-18-plan.md))

## これからの計画(M19)

M19 はリブランディングと配布準備(アプリ内ヘルプページを含む)。

## Milestone 19: リブランディングと配布準備(中・1〜2日規模)

配布ビルドを作る前の名前・アイコン・設定の整備と、アプリ内ヘルプページ。
アプリ名は **tendledge** に決定済み(2026-07-13。表示名は Tendledge と大文字始まり、
package name / バンドル ID 等の識別子は tendledge と全小文字で使い分ける)。

- **名称の決定**: 済み(tendledge / 表示名 Tendledge)
- **名称の反映**: `tauri.conf.json` の `productName` / ウィンドウタイトル /
  `package.json` の name / README。`identifier` は現状プレースホルダ
  (`com.example.asciidoc-editor`)のままなので正式なものへ変更する
  (identifier は設定ストア等の保存場所に影響するため変更手順を設計時に確認)
- **GitHub リポジトリ名の変更** + ローカル remote URL の更新
- **アプリアイコンの作成**: 元画像(1024×1024 PNG)を 1 枚用意し、
  `npm run tauri icon <path>` で全プラットフォーム分(.ico / .icns / PNG 各種)を
  `src-tauri/icons/` に生成する
- **アプリ内ヘルプページ**(ショートカット一覧+知らないと困惑する仕様の明文化)。
  構成案:
  - ショートカット一覧: Ctrl+N / O / S / Shift+S / P / W / Tab /
    Ctrl+K V(分割) / Ctrl+Shift+V(プレビューのみ) / Ctrl+F、
    および basicSetup 由来のエディタ操作(Ctrl+Z・Ctrl+Y、Tab/Shift+Tab の
    インデント、検索パネル内の置換)。注記: Ctrl+K V は Ctrl+K の後 1.5 秒以内、
    Ctrl+F はプレビューのみ表示中はネイティブ検索になる
  - AsciiDoc 対応状況: `include::` 非対応(バグに見えやすいので明記。
    対応検討は [backlog.md](backlog.md))、文書間リンクは `xref:` 推奨
    (`link:*.adoc` は PDF で `.adoc` のまま残る)、パススルー(`++++`)は
    プレビューではサニタイズされるが HTML エクスポートには残る挙動差
  - 図: Mermaid / PlantUML / Draw.io の書き方。**Kroki 有効化時は文書内容が
    外部サーバへ送信される**注意(プライバシー観点で優先度高)
  - エクスポート/印刷: ライト配色固定は仕様であること、
    macOS/Linux の印刷ダイアログ不安定
  - 保管庫: 対応拡張子のみ表示・ドットファイルと空フォルダ非表示・
    ファイル監視なし(↻ で手動更新)
  - タブと未保存データ: Ctrl+W 時の確認とウィンドウ ✕ ボタンの挙動
- **リリースビルドの確認**: `npm run tauri build` を通し、生成物を
  verify-tauri チェックリストで実機確認する
