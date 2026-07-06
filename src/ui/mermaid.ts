// mermaid 図のレンダリング(DOM 層)。テーマ解決やキャッシュキーの判断は
// core/diagram.ts に委譲し、ここは DOM の差し替えだけを担う。
// mermaid 本体はバンドルが 1MB を超えるため静的 import せず、
// 図を含む文書を初めて描画するときに dynamic import する(Vite がチャンク分割する)。
import { MERMAID_LANG, mermaidCacheKey, type MermaidTheme } from "../core/diagram";
import { sanitizeMermaidSvg } from "../render";

type MermaidModule = typeof import("mermaid").default;

// mermaid 標準の default/dark テーマは Slate パレットと馴染まない(dark は緑がかった
// グレー)。mermaid の "base" テーマ + themeVariables で Slate のトークンに合わせる。
// 値は styles.css の :root(ライト)/ [data-theme="dark"] と対応させること
// (どちらかを変えたら両方直す)。図はプレビューでは #preview-pane(--bg 地)、
// エクスポートでは白背景の上に載る。
const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif';

const THEME_VARIABLES: Record<MermaidTheme, Record<string, string>> = {
  default: {
    darkMode: "false",
    background: "#ffffff", // --bg
    primaryColor: "#ececf1", // --bg-raised(ノードの面)
    primaryBorderColor: "#c7c7d2", // --border より一段濃くして輪郭を出す
    primaryTextColor: "#26262e", // --fg
    secondaryColor: "#f4f4f7", // --bg-subtle
    tertiaryColor: "#ffffff",
    lineColor: "#6f6f7e", // --fg-muted(エッジ線)
    textColor: "#26262e", // --fg(ラベル)
    edgeLabelBackground: "#ffffff", // --bg
    fontFamily: FONT_FAMILY,
  },
  dark: {
    darkMode: "true",
    background: "#1b1b22", // --bg
    primaryColor: "#202028", // --bg-raised(ノードの面)
    primaryBorderColor: "#3a3a46", // --border より一段明るくして輪郭を出す
    primaryTextColor: "#dcdce4", // --fg
    secondaryColor: "#26262f", // --code-bg
    tertiaryColor: "#16161c", // --bg-subtle
    lineColor: "#8d8da0", // --fg-muted(エッジ線)
    textColor: "#dcdce4", // --fg(ラベル)
    edgeLabelBackground: "#1b1b22", // --bg
    fontFamily: FONT_FAMILY,
  },
};

let mermaidPromise: Promise<MermaidModule> | undefined;
let initializedTheme: MermaidTheme | undefined;

async function loadMermaid(theme: MermaidTheme): Promise<MermaidModule> {
  mermaidPromise ??= import("mermaid").then((m) => m.default);
  const mermaid = await mermaidPromise;
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      // Slate 準拠の配色は themeVariables で与える。"base" は変数で全面上書きできる
      // カスタム用テーマ(default/dark 固定の配色を避ける)
      theme: "base",
      themeVariables: THEME_VARIABLES[theme],
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
    block.replaceWith(figure);
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
