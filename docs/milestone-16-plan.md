# Milestone 16: パフォーマンス改善

2026-07 のプロジェクト全体レビュー(コードレビュー)の指摘に基づくパフォーマンス改善。
roadmap.md の M16 節がスコープ定義、本書はその設計文書。4項目は互いに独立で、
1項目 = 1コミット(`feature/milestone-16` ブランチ)。

## スコープ(4項目)

| # | 項目 | 種別 | 主な変更場所 |
|---|------|------|--------------|
| 1 | キーストローク毎のタブバー全再構築の抑制 | 再描画抑制 | core/documents.ts, main.ts |
| 2 | `exportHtml` の順序入れ替え | プライバシー/体感改善 | main.ts |
| 3 | Kroki 図の並列 fetch | レイテンシ短縮 | core/concurrency.ts(新規), ui/kroki.ts |
| 4 | `ui/divider.ts` のドラッグ最適化 | 強制スタイル解決の削減 | ui/divider.ts |

## 1. キーストローク毎のタブバー全再構築の抑制

**現状**: `main.ts` の `onDocChanged` が入力1回ごとに `updateTabs()` を呼び、
`renderTabs`(全タブ DOM 再生成)+ `tabOverflow.update()`(scrollWidth 読み取り =
強制レイアウト + `scrollIntoView`)が走る。入力で変わり得る表示は dirty ドットだけ。

**変更**(テストファースト):

- `core/documents.ts` の `updateContent(id, content)` の戻り値を `void` → `boolean`
  (**dirty 状態が変化したか** = 呼び出し前後の `isDirty` 比較)に変更。
  先に `documents.test.ts` へ仕様を追加する:
  - 保存済み → 編集で `true`
  - dirty のまま更に編集で `false`
  - dirty → 保存時と同内容に戻すと `true`
  - 存在しない id は `false`
- `main.ts` の `onDocChanged` では戻り値が `true` のときだけ `updateTabs()` を呼ぶ
  (preview / statusbar の更新は従来どおり毎回)。`updateContent` の呼び出し元は
  `onDocChanged` のみ。

## 2. `exportHtml` の順序入れ替え

**現状**: `main.ts` の `exportHtml()` が `buildExportHtml`(Kroki 有効時は文書内容の
外部送信を含む)→ `save()` ダイアログの順。キャンセルしても送信済みになる。

**変更**: `save()` を先に呼び、`path` が取れなかったら即 return。その後
`buildExportHtml` → `writeTextFile`。副次効果としてダイアログが即座に出る
(重い図の焼き込みがパス決定後に移る)。コード変更は `exportHtml()` 内の並べ替えのみ。

## 3. Kroki 図の並列 fetch

**現状**: `ui/kroki.ts` の `renderKrokiBlocks` が `for (const code of codes)` で
`renderOne` を直列 await するため、図 N 枚で N×レイテンシ待つ。

**変更**:

- 同時実行数制限付きの並列実行ヘルパーを **`core/concurrency.ts`(新規)** に
  テストファーストで実装(純粋ロジックなので core/ 行き)。
  `mapWithConcurrencyLimit(items, limit, fn)` 相当:
  - limit 未満なら全件即時開始 / limit 超過分は先行完了を待って開始
  - 途中で reject があっても他は続行(`renderOne` は内部で catch 済みだが仕様として固定)
  - 同時実行数が limit を超えないことをテストで固定
- `renderKrokiBlocks` の直列ループをこのヘルパー(**limit = 3**)に置き換え。
  既存の挙動を維持する:
  - 世代 abort(`generationController.signal`)→ 未開始分は開始しない・
    実行中は signal で中断
  - リクエスト毎 10s タイムアウト・キャッシュ・エラー表示はそのまま
- **重複 fetch の回避**: 直列時は2枚目の同一ソースがキャッシュヒットしていたが、
  並列化すると同一キーを同時に二重 fetch し得る。世代内で
  `key → Promise<dataUri>` の in-flight マップを持ち、同一キーは 1 fetch に束ねる。

## 4. `ui/divider.ts` のドラッグ最適化

**現状**: `--editor-gutter-width` の `getComputedStyle` 読み取りが pointermove 毎に走る
(スタイル再解決の強制)。

**変更**: ガター幅の読み取りを `pointerdown` 時の 1 回に移動し、`onMove` は
クロージャで参照する(ドラッグ中にガター幅が変わることはない)。
sidebar 幅の `getBoundingClientRect` は挙動維持のためそのまま(スコープ外)。

## 実施順序

1. 項目1(core テストファースト → main.ts)
2. 項目3(core/concurrency.ts テストファースト → ui/kroki.ts)
3. 項目2(main.ts の並べ替えのみ)
4. 項目4(divider.ts)
5. roadmap.md の M16 を実装済みへ移動

## 検証

- `npm test`(documents / concurrency の新規テスト含む)と `npm run build` を通す
- ブラウザプレビュー(**ポート 1421** — 1420 は tauri dev 用に空けておく)でスモーク:
  - 入力しても dirty ドット以外でタブバーが更新されないこと
    (dirty 遷移の瞬間だけ `updateTabs` が走る — devtools の Elements で DOM 再生成が
    毎キーストロークでは起きないことを確認)
  - Kroki 有効設定 + PlantUML ブロック複数で並列に描画されること
    (Network タブで同時リクエストを確認、kroki.io は CORS 可)
  - ディバイダのドラッグが従来どおり動くこと
- 項目2(エクスポートの保存ダイアログ)は Tauri 実機依存 → `verify-tauri` の手順で
  「キャンセル時に Kroki への送信が発生しない(ダイアログより前に fetch が走らない)」を
  確認する
