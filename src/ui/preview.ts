// プレビューの描画とスクロール位置変換の DOM 側。
// 補間計算そのものは core/scroll-sync.ts(純粋関数)に委譲する。
import { extractHeadingLines } from "../core/headings";
import {
  type AnchorPoint,
  editorLineForPreviewScrollTop,
  previewScrollTopForLine,
} from "../core/scroll-sync";
import type { MermaidTheme } from "../core/diagram";
import { decorateAdmonitionIcons } from "./admonition-icons";
import { decorateChecklists } from "./checklist-decoration";
import { decorateCodeBlocks } from "./code-highlight";
import { renderKrokiBlocks } from "./kroki";
import { renderMermaidBlocks } from "./mermaid";
import { convertToPreviewHtml, sanitizePreviewHtml } from "../render";

export interface PreviewController {
  /** 即時に変換・描画する。mermaid 図の非同期描画まで含めて完了で解決する */
  render(source: string): Promise<void>;
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
  /** mermaid 図に使うテーマの提供元(未指定なら図はコードブロックのまま表示) */
  mermaidTheme?: () => MermaidTheme;
  /** Kroki(PlantUML / Draw.io)連携の設定提供元(未指定 or enabled: false なら図はコードブロックのまま表示) */
  kroki?: () => { enabled: boolean; serverUrl: string };
}): PreviewController {
  const { previewEl, paneEl, statusEl, resolveImageSrc, mermaidTheme, kroki } = opts;
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

  // 図のレンダリング(mermaid・Kroki とも)は非同期(初回ロード・ネットワーク
  // 通信を伴う)ため、描画のたびに世代を進め、完了時に世代が古くなっていた
  // 結果は捨てる。古い世代の DOM 操作自体は innerHTML 差し替えで切り離された
  // 要素に向かうので実害はなく、ガードすべきはアンカー再構築だけ。
  let renderGeneration = 0;

  async function decorateMermaid(): Promise<boolean> {
    if (!mermaidTheme) return false;
    try {
      return await renderMermaidBlocks(previewEl, mermaidTheme());
    } catch (err) {
      // 図のレンダリング失敗でプレビュー全体は壊さない
      console.error(err);
      return false;
    }
  }

  async function decorateKroki(): Promise<boolean> {
    const config = kroki?.();
    if (!config?.enabled) return false;
    try {
      return await renderKrokiBlocks(previewEl, { serverUrl: config.serverUrl });
    } catch (err) {
      // 図のレンダリング失敗でプレビュー全体は壊さない
      console.error(err);
      return false;
    }
  }

  async function decorateDiagrams(source: string, generation: number): Promise<void> {
    const [mermaidRendered, krokiRendered] = await Promise.all([
      decorateMermaid(),
      decorateKroki(),
    ]);
    if (generation !== renderGeneration) return;
    if (mermaidRendered || krokiRendered) {
      // 図の挿入で要素の高さが変わるので、スクロール同期のアンカーを取り直す
      rebuildHeadingAnchors(source);
    }
  }

  async function render(source: string): Promise<void> {
    const start = performance.now();
    const generation = ++renderGeneration;
    try {
      const html = sanitizePreviewHtml(await convertToPreviewHtml(source));
      // await の後は他の render() 呼び出しで世代が進んでいる可能性があるため、
      // innerHTML を書き換える直前に世代を確認する(decorateDiagrams 内の
      // 同じガードと同一のイディオム)。無いと、高速に打鍵したときに古い
      // 変換結果が新しいプレビューを上書きしてしまう。
      if (generation !== renderGeneration) return;
      previewEl.innerHTML = html;
      decorateImages();
      decorateChecklists(previewEl);
      decorateAdmonitionIcons(previewEl);
      decorateCodeBlocks(previewEl);
      rebuildHeadingAnchors(source);
      // 図の完了を待ちたい呼び出し元(印刷前のテーマ差し替え)のために返す。
      // 変換 ms のステータスは AsciiDoc 変換(非同期)込みの実時間を計測する
      // (図の描画はキャッシュが効けばほぼゼロ。図の完了自体は待たない)
      const diagramsDone = decorateDiagrams(source, generation);
      statusEl.textContent = `${(performance.now() - start).toFixed(0)} ms`;
      statusEl.classList.remove("error");
      await diagramsDone;
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
