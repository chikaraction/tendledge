// 表示モード切り替えボタンの描画と、workspace への反映(DOM 側)。
// 状態遷移そのものは core/view-mode.ts が持つ。
import type { ViewMode, ViewModeState } from "../core/view-mode";
import { icon, icons } from "./icons";

export interface ViewModeController {
  /** 現在のモードを返す */
  mode(): ViewMode;
  /** モードを反映する(ボタンの見た目 + workspace の data-view-mode) */
  render(state: ViewModeState): void;
}

export function createViewModeControls(
  container: HTMLElement,
  workspace: HTMLElement,
  handlers: { onToggleSplit(): void; onTogglePreview(): void },
): ViewModeController {
  let currentMode: ViewMode = "split";

  const splitBtn = document.createElement("button");
  splitBtn.className = "tabbar-action";
  splitBtn.title = "横にプレビューを開く (Ctrl+K V)";
  splitBtn.addEventListener("click", handlers.onToggleSplit);

  const previewBtn = document.createElement("button");
  previewBtn.className = "tabbar-action";
  previewBtn.addEventListener("click", handlers.onTogglePreview);

  container.replaceChildren(splitBtn, previewBtn);

  function render(state: ViewModeState): void {
    currentMode = state.mode;
    workspace.dataset.viewMode = state.mode;

    splitBtn.setAttribute("aria-pressed", String(state.mode === "split"));
    splitBtn.replaceChildren(icon(icons.splitView, 15));

    const isPreview = state.mode === "preview";
    previewBtn.setAttribute("aria-pressed", String(isPreview));
    previewBtn.title = isPreview
      ? "編集に戻る (Ctrl+Shift+V)"
      : "プレビューとして開く (Ctrl+Shift+V)";
    previewBtn.replaceChildren(icon(isPreview ? icons.edit : icons.previewOnly, 15));
  }

  return {
    mode: () => currentMode,
    render,
  };
}
