// プレビューの描画とスクロール位置変換の DOM 側。
// 補間計算そのものは core/scroll-sync.ts(純粋関数)に委譲する。
import { extractHeadingLines } from "../core/headings";
import {
  type AnchorPoint,
  editorLineForPreviewScrollTop,
  previewScrollTopForLine,
} from "../core/scroll-sync";
import { decorateAdmonitionIcons } from "./admonition-icons";
import { decorateChecklists } from "./checklist-decoration";
import { convertToPreviewHtml, sanitizePreviewHtml } from "../render";

export interface PreviewController {
  /** 即時に変換・描画する(初回描画用) */
  render(source: string): void;
  /** デバウンス付きで変換を予約する(入力中用) */
  scheduleRender(source: string): void;
  /** エディタの行番号に対応するプレビューの scrollTop を返す */
  scrollTopForLine(lineno: number, totalLines: number): number;
  /** プレビューの scrollTop に対応するエディタの行番号を返す */
  lineForScrollTop(scrollTop: number, totalLines: number): number;
  /** デバウンス時間を変更する(設定画面から使う) */
  setDebounceMs(ms: number): void;
  readonly paneEl: HTMLElement;
}

interface HeadingAnchorEl {
  lineno: number;
  el: HTMLElement;
}

export function createPreview(opts: {
  previewEl: HTMLElement;
  paneEl: HTMLElement;
  statusEl: HTMLElement;
  debounceMs?: number;
  /** 相対パス画像の src を表示可能な URL に解決する(不要なら undefined を返す) */
  resolveImageSrc?: (src: string) => string | undefined;
}): PreviewController {
  const { previewEl, paneEl, statusEl, resolveImageSrc } = opts;
  let debounceMs = opts.debounceMs ?? 300;

  // ソースの見出し行とプレビューの h1〜h6 を出現順で対応付ける。
  // Asciidoctor.js の sourcemap は内部AST止まりでHTMLに行番号を出力しないため、
  // 見出し単位のペアリング + 見出し間の線形補間で近似する。
  let headingAnchors: HeadingAnchorEl[] = [];

  function rebuildHeadingAnchors(source: string): void {
    const headingLines = extractHeadingLines(source);
    const headingEls = Array.from(
      previewEl.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
    );
    const n = Math.min(headingLines.length, headingEls.length);
    headingAnchors = Array.from({ length: n }, (_, i) => ({
      lineno: headingLines[i],
      el: headingEls[i],
    }));
  }

  function offsetOf(el: HTMLElement): number {
    const paneRect = paneEl.getBoundingClientRect();
    return el.getBoundingClientRect().top - paneRect.top + paneEl.scrollTop;
  }

  /** アンカーの DOM オフセットをこの瞬間の値で測定し、純粋関数に渡せる形にする */
  function measureAnchors(): AnchorPoint[] {
    return headingAnchors.map((a) => ({ lineno: a.lineno, offset: offsetOf(a.el) }));
  }

  function maxScroll(): number {
    return Math.max(0, paneEl.scrollHeight - paneEl.clientHeight);
  }

  // 相対パスの画像はプレビューの URL 基準では解決できないため、
  // main 側から渡された変換(文書ディレクトリ基準 + asset プロトコル)で書き換える。
  function decorateImages(): void {
    if (!resolveImageSrc) return;
    previewEl.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      const resolved = src ? resolveImageSrc(src) : undefined;
      if (resolved) img.setAttribute("src", resolved);
    });
  }

  function render(source: string): void {
    const start = performance.now();
    try {
      previewEl.innerHTML = sanitizePreviewHtml(convertToPreviewHtml(source));
      decorateImages();
      decorateChecklists(previewEl);
      decorateAdmonitionIcons(previewEl);
      rebuildHeadingAnchors(source);
      statusEl.textContent = `${(performance.now() - start).toFixed(0)} ms`;
      statusEl.classList.remove("error");
    } catch (err) {
      // 変換エラーでも直前のプレビューは保持し、ステータスだけ知らせる
      statusEl.textContent = "変換エラー";
      statusEl.classList.add("error");
      console.error(err);
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  function scheduleRender(source: string): void {
    clearTimeout(timer);
    timer = setTimeout(() => render(source), debounceMs);
  }

  return {
    render,
    scheduleRender,
    scrollTopForLine(lineno, totalLines) {
      return previewScrollTopForLine(lineno, totalLines, measureAnchors(), maxScroll());
    },
    lineForScrollTop(scrollTop, totalLines) {
      return editorLineForPreviewScrollTop(scrollTop, totalLines, measureAnchors(), maxScroll());
    },
    setDebounceMs(ms) {
      debounceMs = ms;
    },
    paneEl,
  };
}
