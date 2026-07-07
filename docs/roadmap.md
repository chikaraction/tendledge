# ロードマップ(Milestone 8 以降)

Milestone 1〜7(エディタ/プレビュー、ペイン、ハイライト、ファイルI/O、スクロール同期、
エクスポート、タブ、保管庫、設定、Slate UI)は実装済み。以降の計画を記す。
各マイルストーンの着手時には `milestone` スキルの手順に従い、
`docs/milestone-N-plan.md` の設計文書を別途起こすこと(本書はその上位のロードマップ)。

推奨着手順: **M8 → M9 → M10 → M11 → M12**。
M8 は小粒の即効タスクで後続の検証素材にもなる。M9/M10 は互いに独立。
M11(Mermaid)で作図系の下地(サンプル・サニタイズ設計)を作ってから、
外部サービス連携を伴う M12 に進むのが低リスク。

## Milestone 8: サンプル文書の整備(小・半日規模)

- `sample/04-tables.adoc` に行結合(`.2+|`)・行列同時結合(`2.2+|`)の例を追加し、
  節見出し「セル結合(列・行)」の実体を揃える
- サンプル中の誤った記法・実挙動と食い違う説明を修正
  (レビューで洗い出した修正候補リストに基づく。ユーザー指摘分も合流させる)
- `src/asciidoc-mode.ts` がセル結合記法(`2+|` `.3+|`)でハイライトを
  壊さないか確認し、必要なら `token()` を拡張(テスト対象)

## Milestone 9: ビューモード切り替え(中・1日規模)

VSCode 風に、タブバー右端のボタンでプレビューの表示形態を切り替える。

- `core/view-mode.ts`(新規・テストファースト):
  「エディタのみ / 分割(現状) / プレビューのみ」の3状態と遷移ルール。
  タブごとではなくウィンドウ単位のモードから始める
- タブバー右端にアクション領域を追加し、Lucide アイコンのボタン2つを配置
  (`ui/icons.ts` の `icons` マップ経由)
  - 「横にプレビューを開く」= 分割 ⇔ エディタのみ のトグル(VSCode の Ctrl+K V 相当)
  - 「プレビューとして開く」= プレビューのみ表示(VSCode の Ctrl+Shift+V 相当)
- divider・スクロール同期はモードに応じて表示/停止。
  ショートカットは `ui/shortcuts.ts`、メニューバー「表示」にも項目を追加
- 表示モードを設定として永続化するか(次回起動時に復元)は設計時に決定

## Milestone 10: プレビューのコードブロック・シンタックスハイライト(中・1日規模)

- 方式: `source-highlighter: highlight.js` 属性で Asciidoctor に言語クラス付き
  HTML を出させ、サニタイズ後に highlight.js をローカルバンドルで適用
  (CDN 依存なし・オフライン動作維持)
- DOMPurify がクラス属性・`<span>` を通すことの確認、
  ダーク/ライトテーマに追従するハイライトテーマの CSS 変数化
- HTML エクスポート(standalone)側の扱い(インライン CSS or スクリプト同梱)を設計判断
- `sample/03-blocks.adoc` に言語サンプルを追加し、説明文を実挙動に一致させる
- スコープ外: エディタ(CodeMirror)側のコードブロック内ネスト言語ハイライト。
  StreamParser では高コストなので、必要なら別マイルストーンに切り出す

## Milestone 11: 作図① Mermaid(中・1日規模)

- `[mermaid]` ブロック(または `[source,mermaid]`)を拾い、
  mermaid.js でクライアントサイドレンダリング(オフライン完結・外部送信なし)
- サニタイズとの整合が要注意: 生成 SVG を `sanitizePreviewHtml` の防壁を
  壊さずに挿入する設計(レンダリング後 DOM への挿入順序、DOMPurify の SVG プロファイル)
- テーマ追従(mermaid の dark/default 切り替え)、`sample/07-diagrams.adoc` を新設
- HTML エクスポートでの扱い(SVG 焼き込み or スクリプト同梱)を設計時に決定

## Milestone 12: 作図② PlantUML / Draw.io(大・要調査・2日規模)

- PlantUML / Draw.io はブラウザ内変換不可のため、Kroki(kroki.io または self-host)へ
  図のソースを送って SVG を得る方式が現実解。
  Kroki は PlantUML / Draw.io(diagramsnet)/ Mermaid ほか多数を単一 API でカバー
- 設計上の論点(実装前にユーザー判断が必要):
  - 文書内容の一部を外部サーバーへ送るため、設定でのオプトイン +
    サーバー URL 設定(self-host 対応)を用意する
  - オフライン時のフォールバック表示
- CSP(`src-tauri/tauri.conf.json`)への Kroki ドメイン追加、
  fetch まわりの権限確認(CLAUDE.md の流儀どおり実物の permissions で確認)
- Draw.io は「Kroki 経由の .drawio 埋め込みレンダリング」までをスコープとし、
  GUI での作図編集は別物(大型)なので必要なら M13 以降で改めて検討

マイルストーンの積み残し・保留項目は本書ではなく [backlog.md](backlog.md) で管理する
(M11 の「横長の図の拡大表示」はそちらへ移動済み)。
