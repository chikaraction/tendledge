// CodeMirror 6 エディタの生成とスクロール関連ヘルパ。
// タブ切替のために「同じ拡張セットで EditorState を作り直す」機能を持つ
// (EditorState をタブごとに保持すれば undo 履歴やカーソル位置もタブごとに保たれる)。
import { indentWithTab } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { basicSetup, EditorView } from "codemirror";
import { tags } from "@lezer/highlight";
import { asciidocMode } from "../asciidoc-mode";

// basicSetup 既定の defaultHighlightStyle は見出し(tags.heading)に下線を付ける。
// AsciiDoc の "=" 見出し行に下線は不要なので、太字だけの非フォールバック
// HighlightStyle で上書きする(fallback ではない方が優先されるため既定の下線が消える)。
const headingHighlight = syntaxHighlighting(
  HighlightStyle.define([{ tag: tags.heading, fontWeight: "700" }]),
);

export interface EditorController {
  view: EditorView;
  /** タブ用に新しい EditorState を作る(拡張セットは共通) */
  newState(content: string): EditorState;
}

export function createEditor(opts: {
  parent: HTMLElement;
  doc: string;
  onDocChanged: (doc: string) => void;
  /** カーソル位置(1 始まりの行・列)が変わったとき(ステータスバー用) */
  onCursorChanged?: (line: number, col: number) => void;
}): EditorController {
  const extensions: Extension = [
    basicSetup,
    keymap.of([indentWithTab]),
    StreamLanguage.define(asciidocMode),
    headingHighlight,
    EditorView.lineWrapping,
    // CodeMirror の既定テーマは常に light 配色なので、Slate のデザイントークン
    // (CSS 変数)で上書きする。ダークテーマ時に行番号ガター等が白いままになるのを防ぐ。
    EditorView.theme({
      "&": { backgroundColor: "var(--bg)", color: "var(--fg)" },
      ".cm-content": { caretColor: "var(--fg)" },
      // CodeMirror の既定 CSS(&light/&dark 前提のセレクタ)は、dark:true を
      // 渡していないこのテーマ設定では発火しない。加えて "&light.cm-focused > ..."
      // のような複合セレクタは詳細度が高く、素の ".cm-cursor" / ".cm-selectionBackground"
      // 指定だけでは負けて黒いカーソル・既定の薄いグレーの選択色のまま上書きされない。
      // 同じ構造のセレクタで明示的に上書きする。
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg)" },
      ".cm-gutters": {
        backgroundColor: "var(--bg-subtle)",
        color: "var(--fg-muted)",
        border: "none",
      },
      // アクティブ行の背景を不透明にすると、背面レイヤーに描かれる選択ハイライトを
      // カーソル行だけ覆い隠してしまう(同一行内の選択が見えなくなる)ため半透明にする。
      ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--fg) 5%, transparent)" },
      ".cm-activeLineGutter": { backgroundColor: "var(--bg-raised)" },
      ".cm-selectionBackground": { backgroundColor: "var(--accent)" },
      // 選択文字列と同じテキストの自動ハイライト(highlightSelectionMatches)。
      // 既定の薄緑は Slate と合わないため、選択色より弱いアクセント色にする。
      ".cm-selectionMatch": {
        backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
      },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
        backgroundColor: "var(--accent)",
      },
      "::selection": { backgroundColor: "var(--accent)" },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        opts.onDocChanged(update.state.doc.toString());
      }
      if (update.selectionSet || update.docChanged) {
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        opts.onCursorChanged?.(line.number, head - line.from + 1);
      }
    }),
  ];

  function newState(content: string): EditorState {
    return EditorState.create({ doc: content, extensions });
  }

  const view = new EditorView({
    state: newState(opts.doc),
    parent: opts.parent,
  });

  // 行番号ガターの実測幅を --editor-gutter-width へ反映する。
  // ガター幅は行数の桁数・フォントサイズ設定で変動するため静的に決め打ちできない
  // (styles.css 側でサイドバー比率の計算に使う)。
  const gutters = view.dom.querySelector<HTMLElement>(".cm-gutters");
  if (gutters) {
    const applyGutterWidth = () => {
      document.documentElement.style.setProperty(
        "--editor-gutter-width",
        `${gutters.getBoundingClientRect().width}px`,
      );
    };
    applyGutterWidth();
    new ResizeObserver(applyGutterWidth).observe(gutters);
  }

  return { view, newState };
}

/** ドキュメント全体を置き換える */
export function setDoc(view: EditorView, content: string): void {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content },
  });
}

/** エディタ表示領域の最上部にある行の番号(1 始まり)を返す */
export function editorTopLine(view: EditorView): number {
  const rect = view.scrollDOM.getBoundingClientRect();
  const pos = view.posAtCoords({ x: rect.left + 4, y: rect.top + 4 }) ?? 0;
  return view.state.doc.lineAt(pos).number;
}

/** 指定行がエディタ表示領域の先頭に来るようスクロールする */
export function editorScrollToLine(view: EditorView, lineno: number): void {
  const line = view.state.doc.line(Math.min(Math.max(lineno, 1), view.state.doc.lines));
  view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: "start" }) });
}
