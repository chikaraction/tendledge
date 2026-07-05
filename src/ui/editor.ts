// CodeMirror 6 エディタの生成とスクロール関連ヘルパ
import { indentWithTab } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { basicSetup, EditorView } from "codemirror";
import { asciidocMode } from "../asciidoc-mode";

export function createEditor(opts: {
  parent: HTMLElement;
  doc: string;
  onDocChanged: (doc: string) => void;
}): EditorView {
  return new EditorView({
    doc: opts.doc,
    parent: opts.parent,
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      StreamLanguage.define(asciidocMode),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          opts.onDocChanged(update.state.doc.toString());
        }
      }),
    ],
  });
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
