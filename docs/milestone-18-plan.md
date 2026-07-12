# Milestone 18: サイドバーの幅リサイズ

roadmap.md の M18 節がスコープ定義、本書はその設計文書。
現状 `--sidebar-width` は 220px 固定。エディタ/プレビュー分割線
([ui/divider.ts](../src/ui/divider.ts))と同じ pointer イベントパターンで、
サイドバーとエディタペインの間にもドラッグ可能な分割線を追加する。
ブランチは `feature/milestone-18`。

## スコープ

| # | 項目 | 主な変更場所 |
|---|------|--------------|
| 1 | 幅クランプの純粋ロジック(テストファースト) | core/sidebar-width.ts(新規)+ テスト |
| 2 | 分割線の DOM・スタイル・ドラッグ配線 | index.html, styles.css, ui/sidebar-divider.ts(新規), main.ts |
| 3 | ドキュメント更新 | verify-tauri スキル, roadmap.md |

**スコープ外**: 幅の永続化はしない(`--editor-ratio` と同様ランタイムのみ —
既存方針との整合)。ダブルクリックでのデフォルト幅リセットもしない
(`#divider` に無い機能なので対称性を保つ)。

## 1. core/sidebar-width.ts — 幅クランプの純粋ロジック

ドラッグ計算のうち「ポインタ位置 → クランプ済みサイドバー幅」の変換を
純粋関数として切り出す(divider.ts は全部 ui 層だが、M18 では milestone
スキルの原則どおり判断ロジックを core/ に置く)。

```ts
export const MIN_SIDEBAR_WIDTH = 150;
export const MAX_SIDEBAR_WIDTH = 500;
/** 最大化などの広いウィンドウでは 500px 固定より広げたいので、幅の40%との大きい方を上限にする */
export const MAX_SIDEBAR_RATIO = 0.4;
/** エディタ+プレビュー側に最低限残すコンテンツ幅 */
export const MIN_CONTENT_WIDTH = 200;

/** サイドバー幅をウィンドウ幅に応じた範囲へクランプ(リサイズ時の再クランプにも使う) */
export function clampSidebarWidth(width: number, workspaceWidth: number): number;

/** ポインタの clientX からクランプ済みのサイドバー幅(px)を返す */
export function sidebarWidthForPointer(
  pointerX: number,
  workspaceLeft: number,
  workspaceWidth: number,
): number;
```

`core/sidebar-width.test.ts` に先に仕様を書く:

- ポインタ位置がそのまま幅になる(`workspaceLeft` からの相対値)
- `MIN_SIDEBAR_WIDTH` 未満は 150 にクランプ(左へ引き切っても消えない)
- `MAX_SIDEBAR_WIDTH` 超は 500 にクランプ(ウィンドウ幅の40%が 500 を下回るとき)
- 広いウィンドウではウィンドウ幅の40%まで広げられる(500 と 40% の大きい方が上限 —
  最大化時に 500px 固定では相対的に狭すぎるため。実装後のフィードバックで追加)
- ウィンドウが狭いときは `workspaceWidth - MIN_CONTENT_WIDTH` が上限になる
  (エディタ/プレビュー側を潰さない)
- その動的上限が `MIN_SIDEBAR_WIDTH` を下回るほど極端に狭い場合は
  `MIN_SIDEBAR_WIDTH` を返す(min 優先 — 不正な負値や 0 を返さない)
- ウィンドウを縮めた後は保持中の幅を新しい上限へ収める(`clampSidebarWidth` —
  広げた幅を持ち越すとサイドバーがウィンドウの大半を占めたままになり、
  次のドラッグ開始時に一瞬で上限まで飛ぶ。実装後のフィードバックで追加)

## 2. 分割線の DOM・スタイル・ドラッグ配線

### index.html

`</aside>` と `#editor-pane` の間に挿入:

```html
<div id="sidebar-divider" role="separator" aria-orientation="vertical"></div>
```

### styles.css

- `#sidebar-divider` は `#divider` と同じ見た目・操作感(flex: none / width 5px /
  cursor: col-resize / background: var(--border) / hover で var(--accent) /
  touch-action: none)。
- **サイドバー非表示時は分割線も隠す**:
  `#sidebar[hidden] + #sidebar-divider { display: none; }`
- `#sidebar` の `border-right: 1px solid var(--border)` は削除する
  (5px の分割線が境界線を兼ねるため。エディタ/プレビュー境界と同じ見た目になる)。
- `@media print` の `display: none !important` リストに `#sidebar-divider` を追加。

レイアウト整合の確認事項(実装変更は不要な見込み):

- `--content-width` は `calc(100% - var(--sidebar-width))` で計算されるが、
  `#sidebar-divider` の 5px は含まれない。既存の `#divider` 5px も同様に
  calc 外でありレイアウトは flex が吸収する(`#preview-pane` が余りを取る)ため、
  同じ扱いでよい。
- 既存 `ui/divider.ts` の onMove はサイドバー幅を `getBoundingClientRect()` で
  実測しているので、幅が可変になっても `--editor-ratio` の計算は正しいまま。

### ui/sidebar-divider.ts(新規)

divider.ts と同じパターン: `pointerdown` で `setPointerCapture` →
`pointermove` で `workspace.getBoundingClientRect()` を取り
`sidebarWidthForPointer(ev.clientX, rect.left, rect.width)` を呼び、
`workspace.style.setProperty("--sidebar-width", `${width}px`)` で反映 →
`pointerup` でリスナー解除。判断ロジックは core 側にあるので ui は配線のみ。

加えて `ResizeObserver` でワークスペースを監視し、リサイズの度に保持中の
インライン `--sidebar-width` を `clampSidebarWidth` で再クランプする
(未ドラッグならインライン値が無いのでスキップ — 既定値 220px は常に範囲内)。

```ts
export function setupSidebarDivider(workspace: HTMLElement, divider: HTMLElement): void;
```

### main.ts

`setupDivider(...)` の隣に 1 行追加するだけ:

```ts
setupSidebarDivider(
  document.getElementById("workspace")!,
  document.getElementById("sidebar-divider")!,
);
```

## 3. ドキュメント更新

- **verify-tauri スキル**: 実機確認項目に追記 —
  保管庫を開いてサイドバー表示 → ドラッグで幅が変わる /
  最小(150px)・最大(500px またはウィンドウ幅 − 200px)でクランプされる /
  幅を変えてもエディタ:プレビューの比率が保たれる /
  サイドバーを非表示にすると分割線も消える(再表示で幅は維持)
- **roadmap.md**: M18 を実装済みへ移動。

## 実施順序(1項目 = 1コミット)

1. 設計文書(本書)のコミット
2. 項目1: core/sidebar-width.test.ts に仕様 → 実装(テストファースト)
3. 項目2: index.html + styles.css + ui/sidebar-divider.ts + main.ts 配線
4. 項目3: verify-tauri チェックリスト追記 + roadmap.md 更新

## 検証

- `npm test`(sidebar-width の新規テスト含む)と `npm run build` を通す。
- ブラウザプレビュー(**ポート 1421** — 1420 は tauri dev 用に空けておく)で
  スモーク: サイドバーは保管庫を開くまで hidden のため、devtools 相当の JS で
  `#sidebar` の hidden を外してからドラッグ・クランプ・非表示連動を確認する。
- 保管庫まわりの実際の表示は Tauri 実機依存なので、verify-tauri スキルの
  追記項目をユーザーに提示して実機確認してもらう。
