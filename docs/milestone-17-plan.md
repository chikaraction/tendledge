# Milestone 17: テスト補強・小掃除

2026-07 のプロジェクト全体レビュー(コードレビュー)の指摘に基づくテスト補強と小掃除。
roadmap.md の M17 節がスコープ定義、本書はその設計文書。項目は互いに独立で、
1項目 = 1コミット(`feature/milestone-17` ブランチ)。

## スコープ(3項目)

| # | 項目 | 種別 | 主な変更場所 |
|---|------|------|--------------|
| 1 | asciidoc-mode のキャラクタリゼーションテスト新設 | テスト補強 | src/asciidoc-mode.test.ts(新規) |
| 2 | タブラベル生成の重複解消 | 小掃除 | core/documents.ts, main.ts, ui/tabs.ts |
| 3 | タブ一覧ドロップダウンの開閉統一 → **backlog 送り(判断のみ)** | 判断 | docs/backlog.md |

## 1. asciidoc-mode のキャラクタリゼーションテスト新設

**現状**: [src/asciidoc-mode.ts](../src/asciidoc-mode.ts) の手書き StreamParser
(blockStack によるネストブロック解決)はリポジトリで最も複雑な純粋ロジックなのに
唯一テストがない。**既存挙動を仕様として固定する**キャラクタリゼーションテストであり、
実装(asciidoc-mode.ts 本体)は一切変更しない。テストが既存挙動と食い違ったら
直すのはテスト側(ただし明らかなバグを見つけたら修正せず報告して backlog 候補にする)。

**配置**: `src/asciidoc-mode.test.ts`(実装と同階層に colocate)。
モジュールは DOM / Tauri に依存しない純粋ロジックなので core/ 相当として扱えるが、
CodeMirror への隣接性からファイル移動はしない(churn 回避)。
Vitest のデフォルト include(`**/*.test.ts`)で拾われるため設定変更は不要。

**テストハーネス**: `@codemirror/language` の公開クラス `StringStream` を使う
(export を index.d.ts で確認済み)。テストファイル冒頭に小さなヘルパーを書く:

```ts
// 文書全体を行単位でトークナイズし、行ごとの [トークン名, テキスト] 列を返す
function tokenize(doc: string): [string | null, string][][] {
  const state = asciidocMode.startState!(2);
  return doc.split("\n").map((line) => {
    const spans: [string | null, string][] = [];
    if (line === "") return spans; // CodeMirror は空行で token() を呼ばない
    const stream = new StringStream(line, 4, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      const tok = asciidocMode.token(stream, state);
      spans.push([tok, stream.current()]);
    }
    return spans;
  });
}
```

連続する同一トークンをまとめる補助(アサーションを読みやすくする)を足してもよい。
期待値の書き方は「行ごとの先頭トークン」や「特定スパンのトークン名」を
it 単位で明示的にアサートする(スナップショットは使わない — 仕様として読める形にする)。

**固定する仕様(describe 構成の目安)**:

- **行頭構文**
  - 見出し: `= タイトル` / `== セクション` → 行全体が `heading`
  - コメント行 `//` → `comment`
  - 属性エントリ `:name: value` / ブロック属性 `[source,js]` → `meta`
  - アドモニション `NOTE:` `TIP:` など → 行頭が `keyword`
  - リストマーカー `* ` `** ` `- ` `. ` `.. ` → `atom`
- **区切りブロック(blockStack)**
  - リスティング `----` / リテラル `....`: 区切り行は `meta`、内部は行全体
    `monospace`。内部では見出し・インライン記法が効かない(monospace のまま)
  - 例示 `====` / サイドバー `****` / 引用 `____` / オープン `--`:
    区切り行は `meta`、内部では見出しやインライン記法が引き続き効く
  - **ネスト**: `====` の中の `****` が正しく開閉し、外側の `====` も
    自分の区切りで閉じる(roadmap 記載の回帰防止の本丸)
  - **完全一致で閉じる**: `-----`(5個)で開けたブロックは `----`(4個)では
    閉じない(モノスペース内部として扱われる)
  - 閉じた後は通常モードに戻る(見出しが再び `heading` になる)
- **表**
  - `|===` の開閉が `meta`
  - セル区切り: `|` 単独、列結合 `2+|`、行結合 `.2+|`、複合 `2.2+|`、
    配置 `<|` `^|` `<.^|`、セルスタイル `a|` → いずれも `punctuation` 1トークン
  - 行内(行頭以外)のセル区切り `|a |b` も `punctuation`
- **インライン記法**
  - `` `code` `` → `monospace`、`*strong*` → `strong`、`_em_` → `emphasis`
  - 相互参照 `<<id>>` `<<id,text>>` → `link`、アンカー `[[id]]` → `meta`、
    属性参照 `{name}` → `meta`
  - マクロ `image::a.png[alt]` `link:url[text]` `footnote:[text]` → `link`
  - 素の URL `https://...` → `link`
  - 記法にマッチしない地の文 → `null`

## 2. タブラベル生成の重複解消

**現状**: `d.path ? basename(d.path) : "Untitled"` が
[main.ts:146](../src/main.ts)(タブ一覧ドロップダウン用)と
[ui/tabs.ts:27](../src/ui/tabs.ts)(タブバー描画)の 2 箇所にある。

**変更**(テストファースト):

- `core/documents.ts` に共有ヘルパーを追加:
  `documentLabel(doc: Pick<DocumentInfo, "path">): string`
  (`core/paths.ts` の `basename` を使用。core → core の依存なのでレイヤ違反なし)。
  先に `documents.test.ts` へ仕様を追加する:
  - path があれば basename(`C:\docs\a.adoc` → `a.adoc`、`/x/y.adoc` → `y.adoc`)
  - path が undefined なら `"Untitled"`
- main.ts と ui/tabs.ts の 2 箇所を `documentLabel(d)` 呼び出しに置き換え、
  ui/tabs.ts の `basename` 直接 import を外す。

## 3. タブ一覧ドロップダウンの開閉統一 → backlog 送り

roadmap は「統一するか、規模が見合わなければ backlog へ送る判断を設計時に行う」
としていた。コードを精査した上での判断: **backlog へ送る**。

**理由**:

- `core/menu.ts` の状態機械の実質的な価値は「複数メニュー間のホバー切り替え」。
  タブ一覧は単独ドロップダウンなので、共有できる core ロジックは boolean 1個分しかなく、
  状態機械の再利用は形だけの統一になる。
- 実際の重複は ui 層の「外側クリック + Escape で閉じる」配線だが、両者は方式が異なる
  (menubar: 常設の window `click` リスナー + 各所の `stopPropagation` 前提 /
  tabs: 開いている間だけの `pointerdown` capture)。統一するには menubar 側の
  stopPropagation 連鎖を触ることになり、ユーザー可視の利得ゼロに対して
  回帰リスクが見合わない。
- 将来ドロップダウンが 3 例目として増えた時点で、共通ヘルパー
  (`ui/dropdown.ts` 案)を抽出するのが妥当。

**作業**: docs/backlog.md に「ドロップダウン開閉配線の共通化(出自: M17 #3・
3例目が現れたら)」として上記の分析を要約して追記する。コード変更はなし。

## 実施順序

1. 項目2(documents.test.ts に仕様追加 → ヘルパー実装 → 2箇所置き換え)— 小さく先に
2. 項目1(テストハーネス → describe 単位で段階的に固定)— 本丸
3. 項目3(backlog.md 追記のみ)
4. roadmap.md の M17 を実装済みへ移動

## 検証

- `npm test`(asciidoc-mode / documents の新規テスト含む)と `npm run build` を通す
- 項目2はブラウザプレビュー(**ポート 1421** — 1420 は tauri dev 用に空けておく)で
  スモーク: タブバーのラベルと、タブを溢れさせた時のタブ一覧ドロップダウンの
  ラベルが従来どおり表示されること(パス付き = ファイル名 / 新規 = Untitled)
- 項目1は挙動変更ゼロ(テスト追加のみ)なので実機確認は不要。
  Tauri 実機依存の変更もないため verify-tauri は対象外
