import { basicSetup, EditorView } from "codemirror";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import Asciidoctor from "@asciidoctor/core";
import { asciidocMode } from "./asciidoc-mode";

// ---------------------------------------------------------------------------
// Asciidoctor.js のセットアップ(プロセッサは1回だけ生成する)
// ---------------------------------------------------------------------------
const asciidoctor = Asciidoctor();

const previewEl = document.getElementById("preview")!;
const statusEl = document.getElementById("status")!;

function render(source: string): void {
  const start = performance.now();
  try {
    const html = asciidoctor.convert(source, {
      safe: "safe",
      attributes: {
        showtitle: true, // 文書タイトル(= 見出し)をプレビューに表示
        sectnums: false,
      },
    }) as string;
    previewEl.innerHTML = html;
    statusEl.textContent = `${(performance.now() - start).toFixed(0)} ms`;
    statusEl.classList.remove("error");
  } catch (err) {
    // 変換エラーでも直前のプレビューは保持し、ステータスだけ知らせる
    statusEl.textContent = "変換エラー";
    statusEl.classList.add("error");
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// デバウンス: 入力が止まってから 300ms 後に変換する
// ---------------------------------------------------------------------------
const DEBOUNCE_MS = 300;
let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleRender(source: string): void {
  clearTimeout(timer);
  timer = setTimeout(() => render(source), DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// CodeMirror 6 エディタ
// ---------------------------------------------------------------------------
const initialDoc = `= はじめての AsciiDoc
:author: あなたの名前

== これは何?

*AsciiDoc* のリアルタイムプレビュー付きエディタです。
左側を編集すると、右側に _すぐ_ 反映されます。

== 使える記法の例

* 箇条書き
* \`モノスペース\` や *太字*
** ネストもできる

. 番号付きリスト
. 二番目

[source,javascript]
----
// コードブロック
const greet = (name) => \`Hello, \${name}!\`;
----

NOTE: アドモニション(注記ブロック)も使えます。

TIP: 表やリンクなど、AsciiDoc の全機能が Asciidoctor.js で変換されます。

|===
| 列 A | 列 B

| セル 1
| セル 2
|===
`;

const view = new EditorView({
  doc: initialDoc,
  parent: document.getElementById("editor-pane")!,
  extensions: [
    basicSetup,
    keymap.of([indentWithTab]),
    StreamLanguage.define(asciidocMode),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        scheduleRender(update.state.doc.toString());
      }
    }),
  ],
});

// 初回描画(デバウンスなしで即時)
render(view.state.doc.toString());
view.focus();

// ---------------------------------------------------------------------------
// ペインのリサイズ(ディバイダのドラッグ)
// ---------------------------------------------------------------------------
const workspace = document.getElementById("workspace")!;
const divider = document.getElementById("divider")!;

divider.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  divider.setPointerCapture(e.pointerId);

  const onMove = (ev: PointerEvent) => {
    const rect = workspace.getBoundingClientRect();
    const ratio = Math.min(0.8, Math.max(0.2, (ev.clientX - rect.left) / rect.width));
    workspace.style.setProperty("--editor-ratio", `${ratio * 100}%`);
  };
  const onUp = () => {
    divider.removeEventListener("pointermove", onMove);
    divider.removeEventListener("pointerup", onUp);
  };
  divider.addEventListener("pointermove", onMove);
  divider.addEventListener("pointerup", onUp);
});
