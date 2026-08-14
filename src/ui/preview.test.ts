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
// 図のレンダリングはこのテストの関心事ではない(重い依存の読み込みも避ける)。
// ただし onHtmlReady のテストでは「図が遅いとき」を作るため、解決を制御できるようにする。
const mermaidGate = { promise: Promise.resolve(false) as Promise<boolean> };
vi.mock("./mermaid", () => ({ renderMermaidBlocks: vi.fn(() => mermaidGate.promise) }));
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
  const preview = createPreview({ previewEl, paneEl, statusEl, mermaidTheme: () => "default" });
  return { preview, previewEl, statusEl };
}

// タブ切替時のスクロール位置復元(main.ts の switchEditorTo)は、
// v3 では「render() から戻れば innerHTML は差し替わっている」ことに依存して
// 同期的に復元していた。v4 で変換が非同期になりその前提が崩れたため、
// HTML が DOM に入った時点を onHtmlReady で通知する。図(mermaid / Kroki)の
// 完了を待つ render() の戻り値とは別のタイミングであることが要点。
describe("createPreview: onHtmlReady(HTML が DOM に入った時点の通知)", () => {
  beforeEach(() => {
    mockedConvert.mockReset();
    mermaidGate.promise = Promise.resolve(false);
  });

  it("HTML が DOM に入った後・図の完了を待たずに呼ばれる", async () => {
    const { preview, previewEl } = setup();
    mockedConvert.mockResolvedValueOnce("<h1>本文</h1>");
    // 図の描画は解決させず、遅い状態のまま止めておく
    let releaseMermaid!: (rendered: boolean) => void;
    mermaidGate.promise = new Promise<boolean>((res) => {
      releaseMermaid = res;
    });

    let htmlAtCallback: string | undefined;
    const renderDone = preview.render("本文", () => {
      htmlAtCallback = previewEl.innerHTML;
    });

    // 図が止まっている間に onHtmlReady が呼ばれ、そのとき既に HTML は入っている
    await vi.waitFor(() => expect(htmlAtCallback).toBeDefined());
    expect(htmlAtCallback).toBe("<h1>本文</h1>");

    releaseMermaid(false);
    await renderDone;
  });

  it("render() の戻り値は onHtmlReady より後、図の完了で解決する", async () => {
    const { preview } = setup();
    mockedConvert.mockResolvedValueOnce("<h1>本文</h1>");
    let releaseMermaid!: (rendered: boolean) => void;
    mermaidGate.promise = new Promise<boolean>((res) => {
      releaseMermaid = res;
    });

    const order: string[] = [];
    const renderDone = preview.render("本文", () => order.push("onHtmlReady"));
    void renderDone.then(() => order.push("renderDone"));

    await vi.waitFor(() => expect(order).toEqual(["onHtmlReady"]));
    releaseMermaid(false);
    await renderDone;
    await Promise.resolve();
    expect(order).toEqual(["onHtmlReady", "renderDone"]);
  });

  it("世代が古くなった変換では onHtmlReady を呼ばない(古いタブの位置を適用しないため)", async () => {
    const { preview } = setup();
    const old = deferred<string>();
    const fresh = deferred<string>();
    mockedConvert.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);

    const calls: string[] = [];
    const oldRender = preview.render("古い内容", () => calls.push("古い"));
    const freshRender = preview.render("新しい内容", () => calls.push("新しい"));

    fresh.resolve("<h1>新しい</h1>");
    await freshRender;
    old.resolve("<h1>古い</h1>");
    await oldRender;

    expect(calls).toEqual(["新しい"]);
  });
});

describe("createPreview: 変換が非同期になったことによる競合状態", () => {
  beforeEach(() => {
    mockedConvert.mockReset();
    mermaidGate.promise = Promise.resolve(false);
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
