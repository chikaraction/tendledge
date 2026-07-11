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

## これからの計画(M14〜M18)

M14〜M17 は 2026-07 のプロジェクト全体レビュー(コードレビュー)の指摘に基づく。
M18 はリブランディングと配布準備。

推奨着手順: **M14 → M15 → M16 / M17(互いに独立・順不同)→ M18(最後)**。
M14 はデータ損失リスクを含むため最優先。M18 は新しいアプリ名の決定が前提になるので、
名称が決まるまでの間に M15〜M17 を進めるのが効率的。

## Milestone 14: データ保護・堅牢性(小〜中・半日規模)

レビュー指摘のうち「データが消える・アプリが固まる」系をまとめて解消する。

- **ウィンドウクローズ時の未保存ガード(最優先)**: 現状、Ctrl+W には確認があるのに
  ウィンドウの✕ボタンでは未保存の変更が無言で消える。Tauri 実機は
  `getCurrentWindow().onCloseRequested` で dirty タブがあれば confirm →
  キャンセルなら `preventDefault()`。ブラウザプレビュー用に `beforeunload` も併設する
- **`walkDir`(main.ts)の堅牢化**: サブフォルダの `readDir` 失敗(アクセス拒否等)を
  try/catch でスキップして残りを表示する。Windows のジャンクション/シンボリックリンク
  循環で無限再帰しないよう深さ上限を設ける。再読み込みボタン経由の `refreshVault` が
  未処理の Promise 拒否で無言失敗しないようエラー表示を付ける
- **タブ切替スクロール復元の競合修正**: `preview.render().then()` 頼みをやめ、
  プレビュー DOM の差し替え直後(同期)に scrollTop を復元し、図の非同期尾部は
  世代ガードで守る(素早い連続切替で古い `.then()` が後勝ちする競合、および
  Kroki 有効時にネットワーク完了までスクロール同期が止まる問題の両方を解消)。
  `ui/scroll-sync.ts` の suspend も boolean から世代/カウント方式へ
- **`ui/shortcuts.ts` の修飾キー判定**: Ctrl+F が Shift/Alt 併押下でも発火する
  (欧州系レイアウトの AltGr+F は ctrlKey+altKey として届くため文字入力を潰す)。
  Alt 併押下を除外する
- **ウィンドウ最小サイズ**: `tauri.conf.json` に `minWidth` / `minHeight` を追加し、
  極端に狭いウィンドウで `ui/divider.ts` の比率計算が NaN になる端を
  分母ガードとあわせて塞ぐ

## Milestone 15: セキュリティ強化(小・半日規模)

WebView は第三者の .adoc を開く(保管庫)ため、DOMPurify が破られた場合の
影響範囲を狭める。設定変更が中心だが、すべて実機確認(verify-tauri)が必要。

- **`withGlobalTauri: false` へ変更**: `window.__TAURI__` はフロントエンドで未使用
  (grep 確認済み。ES import のみ使用)。無効化すれば XSS 時の攻撃面が確実に減る
- **`fs:scope: ["**"]` の縮小を検討**(例: ユーザープロファイル配下のみ)。
  M13 で「fs:scope なしでは保管庫サブフォルダが開けない」と判明した経緯
  (CLAUDE.md 参照)があるため、縮小後に保管庫サブフォルダのファイルが開けることを
  実機確認する。判断を保留する場合は「現状維持」と理由を本書か設計文書に明記して閉じる
- **CSP・`assetProtocol.scope: ["**"]` の再点検**(同上の判断を記録する)

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
