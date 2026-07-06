// プレビュー内リンククリックの横取り(DOM 側)。
// どう扱うかの判断は core/preview-links.ts(純粋関数)に委譲する。
import { classifyPreviewLink } from "../core/preview-links";

export function setupPreviewLinks(opts: {
  paneEl: HTMLElement;
  /** アクティブ文書のパス(無題なら undefined) */
  currentDocPath: () => string | undefined;
  /** 相対リンク先の対応ファイルをタブとして開く */
  openFile: (path: string) => void;
  /** 外部 URL をシステム側で開く */
  openExternal: (url: string) => void;
}): void {
  const { paneEl } = opts;
  paneEl.addEventListener("click", (ev) => {
    const anchor = (ev.target as Element | null)?.closest("a");
    if (!anchor || !paneEl.contains(anchor)) return;
    // WebView 自体が遷移するとアプリごと初期化されるため、遷移は常に抑止する
    ev.preventDefault();
    const action = classifyPreviewLink(anchor.getAttribute("href"), opts.currentDocPath());
    switch (action.kind) {
      case "anchor":
        paneEl.querySelector(`#${CSS.escape(action.id)}`)?.scrollIntoView({ block: "start" });
        break;
      case "external":
        opts.openExternal(action.url);
        break;
      case "open-file":
        opts.openFile(action.path);
        break;
    }
  });
}
