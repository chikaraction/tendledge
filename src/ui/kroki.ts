// Kroki(PlantUML / Draw.io)図のレンダリング(DOM 層)。
// 種別解決・URL 構築・キャッシュキー・data URI 化は core/kroki.ts に委譲し、
// ここは fetch 呼び出しと DOM の差し替えだけを担う。
//
// 通信は tauri-plugin-http 経由にする(window.fetch ではなく)。理由:
// self-host のサーバー URL は実行時の設定値であり、静的な CSP の
// connect-src では許可できないが、plugin-http は Rust 側で通信するため
// ページの CSP / CORS の制約を受けない(許可範囲は capability の scope で管理)。
// ブラウザプレビュー(npm run dev, Tauri シェルなし)では plugin-http が
// 使えないため window.fetch にフォールバックする(kroki.io は CORS `*` を返す)。
import { isTauri } from "@tauri-apps/api/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { mapWithConcurrencyLimit } from "../core/concurrency";
import { KROKI_LANGS, krokiCacheKey, krokiRequestUrl, svgToDataUri } from "../core/kroki";

const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_LIMIT = 100;
// 同時にサーバーへ投げる Kroki リクエストの上限(直列だと図 N 枚で N×レイテンシ待つため並列化)
const KROKI_CONCURRENCY_LIMIT = 3;

// キャッシュキー(サーバー + 言語 + ソース)→ data URI。
// 同一ソースの再描画(入力デバウンス)のたびにサーバーへ再送しないための
// 素朴なキャッシュ(mermaid と同方式)。これが実質的なリクエスト抑制にもなる。
const dataUriCache = new Map<string, string>();

function resolveFetch(): typeof fetch {
  return isTauri() ? (tauriFetch as typeof fetch) : window.fetch.bind(window);
}

function errorMessage(lang: string, err: unknown): string {
  if (err instanceof DOMException && err.name === "AbortError") {
    return `Kroki(${lang}): サーバーに接続できません(タイムアウト)`;
  }
  if (err instanceof TypeError) {
    return `Kroki(${lang}): サーバーに接続できません`;
  }
  return `Kroki(${lang}) エラー: ${err instanceof Error ? err.message : String(err)}`;
}

/**
 * 指定キーの data URI を取得する。キャッシュ済みならそれを返し、未キャッシュなら
 * fetch する。同一世代内(inFlight)で同じキーへの fetch がすでに進行中なら、
 * その Promise を共有する(並列化した際に同一ソースを二重 fetch しないため)。
 */
function fetchDataUri(
  key: string,
  url: string,
  source: string,
  fetchFn: typeof fetch,
  staleSignal: AbortSignal,
  inFlight: Map<string, Promise<string>>,
): Promise<string> {
  const cached = dataUriCache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const controller = new AbortController();
    const onStale = () => controller.abort();
    staleSignal.addEventListener("abort", onStale);
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: source,
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        // Kroki は構文エラー時、理由をプレーンテキストの本文で返す
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      const dataUri = svgToDataUri(text);
      if (dataUriCache.size >= CACHE_LIMIT) dataUriCache.clear();
      dataUriCache.set(key, dataUri);
      return dataUri;
    } finally {
      clearTimeout(timeout);
      staleSignal.removeEventListener("abort", onStale);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

async function renderOne(
  code: HTMLElement,
  lang: string,
  serverUrl: string,
  fetchFn: typeof fetch,
  staleSignal: AbortSignal,
  inFlight: Map<string, Promise<string>>,
): Promise<void> {
  const block = code.closest(".listingblock, .literalblock") ?? code;
  const doc = code.ownerDocument;
  const source = (code.textContent ?? "").trim();
  const url = krokiRequestUrl(serverUrl, lang);
  if (!url) return; // KROKI_LANGS に含まれる言語のみ呼び出されるので通常到達しない
  const key = krokiCacheKey(serverUrl, lang, source);

  try {
    const dataUri = await fetchDataUri(key, url, source, fetchFn, staleSignal, inFlight);
    const figure = doc.createElement("div");
    figure.className = "kroki-diagram";
    const img = doc.createElement("img");
    img.src = dataUri;
    img.alt = lang;
    figure.appendChild(img);
    // block 全体(.listingblock/.literalblock)を差し替えると、
    // ブロックタイトル(`.タイトル` 記法の `.title` div)まで消えてしまうため、
    // コード本体だけを包む .content を差し替える(タイトルは兄弟要素として残す)
    block.classList.remove("kroki-loading");
    const target = block.querySelector(":scope > .content") ?? block;
    target.replaceWith(figure);
  } catch (err) {
    // 失敗時はコードブロックを残し、直下に知らせる(mermaid と同じ思想)
    block.classList.remove("kroki-loading");
    const message = doc.createElement("div");
    message.className = "kroki-error";
    message.textContent = errorMessage(lang, err);
    block.after(message);
  }
}

// 直前の呼び出しが完了していないうちに次の renderKrokiBlocks が呼ばれたら
// (連打入力・世代交代)、進行中のリクエストを打ち切ってサーバー負荷と
// 無駄な待ちを避ける。
let currentGenerationController: AbortController | undefined;

/**
 * root 配下の PlantUML / Draw.io コードブロックを図(<img> data URI)に差し替える。
 * 1つでも処理したら true を返す(呼び出し側のアンカー再構築の要否判定に使う)。
 * 挿入は inline SVG ではなく <img> data URI にする: Kroki の SVG は外部サーバー
 * 由来であり、かつ Draw.io はラベルに foreignObject を使う(mermaid のような
 * htmlLabels 無効化で回避できない)。画像コンテキストならスクリプト実行が
 * 構造的に起きないため、サニタイズと表示品質を両立できる。
 */
export async function renderKrokiBlocks(
  root: ParentNode,
  opts: { serverUrl: string; fetchFn?: typeof fetch },
): Promise<boolean> {
  const selector = KROKI_LANGS.map((lang) => `code[data-lang="${lang}"]`).join(", ");
  const codes = Array.from(root.querySelectorAll<HTMLElement>(selector));
  if (codes.length === 0) return false;

  codes.forEach((code) => {
    code.closest(".listingblock, .literalblock")?.classList.add("kroki-loading");
  });

  currentGenerationController?.abort();
  const generationController = new AbortController();
  currentGenerationController = generationController;

  const fetchFn = opts.fetchFn ?? resolveFetch();
  // 世代内で key(サーバー+言語+ソース)→ fetch の Promise を共有し、並列化に伴う
  // 同一ソースの二重 fetch を防ぐ(DOM 差し替え自体は renderOne 側で各ブロックごとに行う)。
  const inFlight = new Map<string, Promise<string>>();

  await mapWithConcurrencyLimit(codes, KROKI_CONCURRENCY_LIMIT, async (code) => {
    if (generationController.signal.aborted) return; // 未開始分は開始しない
    const lang = code.dataset.lang;
    if (!lang) return;
    await renderOne(code, lang, opts.serverUrl, fetchFn, generationController.signal, inFlight);
  });
  return true;
}
