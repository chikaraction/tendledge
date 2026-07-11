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

## これからの計画(M16〜M18)

M16〜M17 は 2026-07 のプロジェクト全体レビュー(コードレビュー)の指摘に基づく。
M18 はリブランディングと配布準備。

推奨着手順: **M16 / M17(互いに独立・順不同)→ M18(最後)**。
M18 は新しいアプリ名の決定が前提になるので、名称が決まるまでの間に
M16〜M17 を進めるのが効率的。

## Milestone 16: パフォーマンス改善(小〜中・半日規模)

- **キーストローク毎のタブバー全再構築の抑制**: 現状は 1 入力ごとに
  `updateTabs()` → タブ全 DOM 再生成 + scrollWidth 読み取り(強制レイアウト)+
  `scrollIntoView` が走る。`core/documents.ts` に「dirty 状態が変化したか」を
  返す仕組みを追加(テストファースト)し、変化時のみ `updateTabs()` を呼ぶ
- **`exportHtml` の順序入れ替え**: 現状は HTML 構築(Kroki 有効時は文書内容の
  外部送信を含む)が保存ダイアログより先に走るため、キャンセルしても送信済みになる。
  `save()` を先に呼ぶ
- **Kroki 図の並列 fetch**: `ui/kroki.ts` の直列 for-await を同時数制限
  (2〜3本)付きの並列に(図 N 枚で N×レイテンシ待つ現状を短縮)
- **`ui/divider.ts` のドラッグ最適化**: ガター幅の `getComputedStyle` 読み取りを
  pointermove 毎ではなく pointerdown 時の 1 回に

## Milestone 17: テスト補強・小掃除(中・1日規模)

- **`src/asciidoc-mode.ts` のキャラクタリゼーションテスト新設**:
  手書き StreamParser(blockStack によるネストブロック解決)はリポジトリで最も複雑な
  純粋ロジックなのに唯一テストがない。トークン列を仕様として固定する
  (ネストブロック・見出し・テーブル・セル結合などの回帰防止)
- **タブラベル生成の重複解消**: `d.path ? basename(d.path) : "Untitled"` が
  main.ts と ui/tabs.ts の 2 箇所にある。共有ヘルパーに集約する
- **タブ一覧ドロップダウンの開閉統一**: ui/tabs.ts のドロップダウン開閉
  (外側クリック・Escape)が core/menu.ts の状態機械と別実装になっている。
  統一するか、規模が見合わなければ backlog へ送る判断を設計時に行う

## Milestone 18: リブランディングと配布準備(中・1日規模+名称決定)

配布ビルドを作る前の名前・アイコン・設定の整備。**新しいアプリ名の決定が前提**
(アプリ名とリポジトリ名は現行の asciidoc-editor から変更予定)。

- **新しいアプリ名の決定**(未定。ここが以降すべての前提)
- **名称の反映**: `tauri.conf.json` の `productName` / ウィンドウタイトル /
  `package.json` の name / README。`identifier` は現状プレースホルダ
  (`com.example.asciidoc-editor`)のままなので正式なものへ変更する
  (identifier は設定ストア等の保存場所に影響するため変更手順を設計時に確認)
- **GitHub リポジトリ名の変更** + ローカル remote URL の更新
- **アプリアイコンの作成**: 元画像(1024×1024 PNG)を 1 枚用意し、
  `npm run tauri icon <path>` で全プラットフォーム分(.ico / .icns / PNG 各種)を
  `src-tauri/icons/` に生成する
- **リリースビルドの確認**: `npm run tauri build` を通し、生成物を
  verify-tauri チェックリストで実機確認する
