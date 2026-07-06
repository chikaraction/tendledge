# Milestone 9: ビューモード切り替え

## 目標

VSCode の Markdown プレビューと同様に、タブバー右端のボタンで
「エディタのみ / 分割(現状) / プレビューのみ」を切り替えられるようにする。
モードはタブごとではなく**ウィンドウ単位**(roadmap の決定どおり)。

## スコープ

1. **core/view-mode.ts(新規・テストファースト)** — 3状態と遷移ルールの純粋ロジック
2. **タブバー右端のアクション領域** — Lucide アイコンのボタン2つ
3. **CSS によるペイン表示切り替え** — `data-view-mode` 属性駆動
4. **ショートカットとメニュー統合** — Ctrl+K V / Ctrl+Shift+V、「表示」メニューに3項目
5. **モード切替時のスクロール同期** — 再表示されたペインの位置合わせ

スコープ外: モードの永続化(→ 設計判断①)、タブごとのモード保持、
プレビュー単独ウィンドウ化。

## 状態と遷移(core/view-mode.ts)

```
ViewMode = "editor" | "split" | "preview"
ViewModeState = { mode: ViewMode, lastEditMode: "editor" | "split" }
```

- `toggleSplit(state)` — 「横にプレビューを開く」(VSCode Ctrl+K V 相当)
  - `editor → split` / `split → editor` / `preview → split`
- `togglePreview(state)` — 「プレビューとして開く」(VSCode Ctrl+Shift+V 相当)
  - `editor → preview` / `split → preview`
  - `preview → lastEditMode`(プレビューに入る直前の編集モードへ戻る。
    このために `lastEditMode` を持つ — editor から入ったら editor へ、
    split から入ったら split へ戻る)
- `setMode(state, mode)` — メニューからの直接指定用。
  `preview` 以外を設定したときは `lastEditMode` も更新する

遷移は new state を返す純粋関数とし、`view-mode.test.ts` に
日本語 describe/it で全遷移を仕様として書いてから実装する。

## UI 設計

### タブバーのアクション領域(index.html + ui/tabs.ts + ui/view-mode.ts)

`#tabbar` を2区画に分ける(静的スケルトンは index.html の責務):

```html
<nav id="tabbar" aria-label="開いているドキュメント">
  <div id="tabbar-tabs"></div>      <!-- renderTabs の描画先(横スクロール) -->
  <div id="tabbar-actions"></div>   <!-- 右端固定のボタン領域 -->
</nav>
```

`renderTabs` は `#tabbar-tabs` を対象にするよう main.ts の配線を変更
(tabs.ts 自体は container を受け取るだけなので無変更)。

ボタンは新規モジュール `ui/view-mode.ts` が描画・更新する:

| ボタン | アイコン(lucide) | 動作 | title |
| --- | --- | --- | --- |
| 分割トグル | `Columns2` | `toggleSplit` | 横にプレビューを開く (Ctrl+K V) |
| プレビュートグル | `Eye`(preview 中は `Pencil`) | `togglePreview` | プレビューとして開く / 編集に戻る (Ctrl+Shift+V) |

- アイコンは `ui/icons.ts` の `icons` マップに `splitView: Columns2` /
  `previewOnly: Eye` / `edit: Pencil` を追加して経由する(直接 import しない)
- 現在モードを `aria-pressed` で表現し、CSS でアクティブ表示
  (`Columns2` は split 中に pressed、`Eye/Pencil` は preview 中に切り替え)

### ペインの表示切り替え(styles.css)

main.ts(配線)が `#workspace` に `data-view-mode` 属性を設定し、CSS が反映する:

```css
#workspace[data-view-mode="editor"] :is(#preview-pane, #divider) { display: none; }
#workspace[data-view-mode="editor"] #editor-pane { width: auto; flex: 1; }
#workspace[data-view-mode="preview"] :is(#editor-pane, #divider) { display: none; }
```

- `split` は属性なし(現状のレイアウトそのまま)。`--editor-ratio` は
  split 復帰時にそのまま生きる(モード切替でリセットしない)
- サイドバーはモードと独立(preview モードでもファイルツリーからタブを開ける)
- **@media print への追記が必要**: editor モード中は上記ルールで
  `#preview-pane` が `display: none` になるため、print ブロックに
  `#preview-pane { display: block !important; }` を足さないと
  エディタのみ表示中の PDF エクスポートが白紙になる

### ショートカット(ui/shortcuts.ts)

- `Ctrl+Shift+V` — `togglePreview`。既存ハンドラ構造に1分岐追加
  (プレーンテキストエディタなので「書式なし貼り付け」との衝突は実害なし)
- `Ctrl+K V` — `toggleSplit`。**コード(2打鍵)対応が必要**:
  `Ctrl+K` で pending 状態に入り、続く `V` で発火。タイムアウト(約1.5秒)か
  他キーで解除。pending 判定の小さな状態遷移は core/view-mode.ts に
  純粋関数(`chordStep` など)として置きテスト対象にする。
  keydown の配線・タイマーだけを ui/shortcuts.ts に書く
- CodeMirror 標準キーマップは Windows で Ctrl+K / Ctrl+Shift+V を
  使わないため衝突しないが、`preventDefault` は明示する

### メニュー(main.ts の MenuDef)

「表示」メニューのサイドバーの下に3項目をラジオ風に追加
(テーマの `checked()` パターンを踏襲):

- エディタのみ / 分割 — Ctrl+K V / プレビューのみ — Ctrl+Shift+V
- `checked: () => mode === "..."` + `onSelect: () => setMode(...)`

### スクロール同期・レンダリングとの整合

- **非表示ペインのレンダリングは止めない**。`preview.scheduleRender` は
  editor モード中も従来どおり動かす(デバウンス済みで軽く、
  HTML/PDF エクスポートやモード復帰時に常に最新である方が単純)
- 非表示ペインは scroll イベント自体が発生しないので、既存の
  `syncingScroll` ガードに変更は不要
- モード切替時に片側だけ一度同期する:
  - preview が再表示されたとき(editor → split/preview):
    エディタの現在行から `preview.scrollTopForLine` で位置合わせ
  - preview → editor/split で editor が再表示されたとき:
    プレビューの scrollTop から `preview.lineForScrollTop` で
    エディタを位置合わせ(プレビューだけ読み進めた位置を引き継ぐ)
- preview モード中もタブ切替(Ctrl+Tab・ファイルツリー)は従来どおり動く
  (`switchEditorTo` が `preview.render` を呼ぶ構造は無変更。
  非表示エディタへの `view.focus()` は no-op で無害)

## 設計判断

1. **永続化はしない(M9 では毎回 split で起動)** — 表示モードは
   「設定」ではなく一時的な UI 状態であり、settings.json のスキーマを
   汚さない。必要になったら別ファイル(ui-state.json)として追加できる。
   *→ ユーザーと要擦り合わせ*
2. **ウィンドウ単位のモード**(roadmap で決定済み)— タブごとの保持は
   将来必要になってから `core/documents.ts` 側に寄せる
3. **非表示でもレンダリング継続**(上述)— 停止による節約より
   エクスポート・印刷の正しさと実装の単純さを優先
4. **プレビュートグルのアイコンを状態で変える**(Eye ⇔ Pencil)—
   VSCode と同じく「いま押すと何になるか」を示す

## モジュール構成(差分)

```
src/
  core/view-mode.ts       新規: 3状態・遷移・コード判定(純粋・テスト付き)
  core/view-mode.test.ts  新規: 全遷移の仕様
  ui/view-mode.ts         新規: アクションボタン描画 + data-view-mode 適用
  ui/icons.ts             icons に splitView / previewOnly / edit を追加
  ui/shortcuts.ts         Ctrl+Shift+V と Ctrl+K コードの配線を追加
  main.ts                 配線: モード状態の保持・メニュー項目・切替時同期
index.html                #tabbar を #tabbar-tabs + #tabbar-actions に分割
src/styles.css            data-view-mode ルール + アクション領域 + print 追記
```

## 実施順序(1機能 = 1コミット、ブランチ: feature/milestone-9-view-mode)

1. `core/view-mode.ts` — テストファーストで遷移ロジック(コード判定含む)
2. タブバー分割 + アクションボタン + CSS 切り替え(クリックで3モードが動く状態)
3. ショートカット(Ctrl+K V / Ctrl+Shift+V)+「表示」メニュー項目
4. モード切替時のスクロール同期 + @media print 対応

## 検証

- `npm test` / `npm run build`
- ブラウザプレビューでスモークテスト(本機能は Tauri API 非依存なので
  ボタン・ショートカット・メニュー・レイアウトはすべてブラウザで確認可能)
  - 3モードの往復、preview → 戻りで lastEditMode が効くこと
  - divider ドラッグ後に editor → split 復帰で比率が保持されること
  - preview モード中のタブ切替・ファイルツリーからのオープン
- 印刷のみ Tauri 実機確認(editor モード中の PDF エクスポートが白紙にならないこと)
  — `verify-tauri` スキルのチェックリストにこの項目を追記する
