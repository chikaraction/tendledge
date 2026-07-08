// mermaid 図のレンダリング(DOM 層)。テーマ解決やキャッシュキーの判断は
// core/diagram.ts に委譲し、ここは DOM の差し替えだけを担う。
// mermaid 本体はバンドルが 1MB を超えるため静的 import せず、
// 図を含む文書を初めて描画するときに dynamic import する(Vite がチャンク分割する)。
import { MERMAID_LANG, mermaidCacheKey, type MermaidTheme } from "../core/diagram";
import { sanitizeMermaidSvg } from "../render";

type MermaidModule = typeof import("mermaid").default;

let mermaidPromise: Promise<MermaidModule> | undefined;
let initializedTheme: MermaidTheme | undefined;

async function loadMermaid(theme: MermaidTheme): Promise<MermaidModule> {
  mermaidPromise ??= import("mermaid").then((m) => m.default);
  const mermaid = await mermaidPromise;
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      // エラー時に body へエラー図を勝手に注入させない(エラー表示は自前で出す)
      suppressErrorRendering: true,
      // ラベルを foreignObject 内 HTML ではなく純粋な SVG text で出させる。
      // sanitizeMermaidSvg(SVG プロファイル)が foreignObject を落とすため、
      // これを無効にしないとラベルが消える
      htmlLabels: false,
    });
    initializedTheme = theme;
  }
  return mermaid;
}

// テーマ込みキー → サニタイズ済み SVG。デバウンス再描画のたびに全図を
// レンダリングし直さないための素朴なキャッシュ(mermaid.render は1図あたり数十 ms)。
const svgCache = new Map<string, string>();
const CACHE_LIMIT = 100;

let renderSeq = 0;

async function renderOne(
  mermaid: MermaidModule,
  code: HTMLElement,
  theme: MermaidTheme,
): Promise<void> {
  const block = code.closest(".listingblock, .literalblock") ?? code;
  const doc = code.ownerDocument;
  const source = (code.textContent ?? "").trim();
  const key = mermaidCacheKey(theme, source);
  try {
    let svg = svgCache.get(key);
    if (svg === undefined) {
      const rendered = await mermaid.render(`mermaid-diagram-${++renderSeq}`, source);
      svg = sanitizeMermaidSvg(rendered.svg);
      if (svgCache.size >= CACHE_LIMIT) svgCache.clear();
      svgCache.set(key, svg);
    }
    const figure = doc.createElement("div");
    figure.className = "mermaid-diagram";
    figure.innerHTML = svg;
    // block 全体(.listingblock/.literalblock)を差し替えると、
    // ブロックタイトル(`.タイトル` 記法の `.title` div)まで消えてしまうため、
    // コード本体だけを包む .content を差し替える(タイトルは兄弟要素として残す)
    block.classList.remove("mermaid-loading");
    const target = block.querySelector(":scope > .content") ?? block;
    target.replaceWith(figure);
  } catch (err) {
    // 構文エラー等では図に差し替えず、元のコードブロックを残して直下に知らせる
    // (書きかけの構文が見えるほうが編集体験がよい)
    block.classList.remove("mermaid-loading");
    const message = doc.createElement("div");
    message.className = "mermaid-error";
    message.textContent = `Mermaid 構文エラー: ${err instanceof Error ? err.message : String(err)}`;
    block.after(message);
  }
}

/**
 * root 配下の mermaid コードブロックを図(サニタイズ済み SVG)に差し替える。
 * 1つでも処理したら true を返す(呼び出し側のアンカー再構築の要否判定に使う)。
 * 入力はサニタイズ済み DOM の textContent のみ。失敗したブロックは元のまま残す。
 */
export async function renderMermaidBlocks(
  root: ParentNode,
  theme: MermaidTheme,
): Promise<boolean> {
  const codes = Array.from(
    root.querySelectorAll<HTMLElement>(`code[data-lang="${MERMAID_LANG}"]`),
  );
  if (codes.length === 0) return false;

  // mermaid 本体のロード中(初回のみ数百 ms)であることを CSS で示す
  codes.forEach((code) => {
    code.closest(".listingblock, .literalblock")?.classList.add("mermaid-loading");
  });

  const mermaid = await loadMermaid(theme);
  for (const code of codes) {
    await renderOne(mermaid, code, theme);
  }
  return true;
}
