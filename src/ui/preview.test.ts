// @vitest-environment jsdom
// プレビュー描画の競合状態(世代ガード)の回帰テスト。
//
// @asciidoctor/core 4 で変換が非同期になったため、render() は await を挟む。
// その結果、打鍵が速いと「古い変換の完了」が「新しい変換の完了」より後に届き、
// 古い結果が新しいプレビューを上書きしうる。これは実機の手動操作では再現が
// 難しい(変換は CPU バウンドで、外から2つの変換を重ねられない)ため、
// 変換関数をモックして解決順序を明示的に入れ替えることで固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../render", () => ({
  convertToPreviewHtml: vi.fn(),
  sanitizePreviewHtml: (html: string) => html,
}));
// 図のレンダリングはこのテストの関心事ではない(重い依存の読み込みも避ける)
vi.mock("./mermaid", () => ({ renderMermaidBlocks: vi.fn(async () => false) }));
vi.mock("./kroki", () => ({ renderKrokiBlocks: vi.fn(async () => false) }));

import { convertToPreviewHtml } from "../render";
import { createPreview } from "./preview";

const mockedConvert = vi.mocked(convertToPreviewHtml);

/** 手動で解決/棄却できる Promise を作る */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  document.body.innerHTML = `<div id="pane"><div id="preview"></div></div><span id="status"></span>`;
  const previewEl = document.getElementById("preview") as HTMLElement;
  const paneEl = document.getElementById("pane") as HTMLElement;
  const statusEl = document.getElementById("status") as HTMLElement;
  const preview = createPreview({ previewEl, paneEl, statusEl });
  return { preview, previewEl, statusEl };
}

describe("createPreview: 変換が非同期になったことによる競合状態", () => {
  beforeEach(() => {
    mockedConvert.mockReset();
  });

  it("古い変換が新しい変換より後に解決しても、プレビューを上書きしない", async () => {
    const { preview, previewEl } = setup();
    const old = deferred<string>();
    const fresh = deferred<string>();
    mockedConvert.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);

    const oldRender = preview.render("古い内容");
    const freshRender = preview.render("新しい内容");

    // 新しい方が先に解決する
    fresh.resolve("<h1>新しい</h1>");
    await freshRender;
    expect(previewEl.innerHTML).toBe("<h1>新しい</h1>");

    // 遅れて古い方が解決しても上書きされない
    old.resolve("<h1>古い</h1>");
    await oldRender;
    expect(previewEl.innerHTML).toBe("<h1>新しい</h1>");
  });

  it("古い変換の失敗が、新しい変換の成功後にステータスを「変換エラー」で上書きしない", async () => {
    const { preview, statusEl } = setup();
    const old = deferred<string>();
    const fresh = deferred<string>();
    mockedConvert.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);

    const oldRender = preview.render("古い内容");
    const freshRender = preview.render("新しい内容");

    fresh.resolve("<h1>新しい</h1>");
    await freshRender;
    expect(statusEl.textContent).toMatch(/ms$/);
    expect(statusEl.classList.contains("error")).toBe(false);

    old.reject(new Error("変換に失敗"));
    await oldRender;
    expect(statusEl.textContent).toMatch(/ms$/);
    expect(statusEl.classList.contains("error")).toBe(false);
  });

  it("最新の変換が失敗したときは「変換エラー」を表示し、直前のプレビューを保持する", async () => {
    const { preview, previewEl, statusEl } = setup();
    const first = deferred<string>();
    const second = deferred<string>();
    mockedConvert.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const firstRender = preview.render("最初の内容");
    first.resolve("<h1>最初</h1>");
    await firstRender;

    const secondRender = preview.render("壊れた内容");
    second.reject(new Error("変換に失敗"));
    await secondRender;

    expect(previewEl.innerHTML).toBe("<h1>最初</h1>"); // 直前のプレビューは保持
    expect(statusEl.textContent).toBe("変換エラー");
    expect(statusEl.classList.contains("error")).toBe(true);
  });
});
