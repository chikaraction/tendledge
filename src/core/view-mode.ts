// 表示モード(エディタのみ / 分割 / プレビューのみ)の状態と遷移ルール(純粋ロジック)。
// ウィンドウ単位のモードで、タブごとには持たない。

export type ViewMode = "editor" | "split" | "preview";
/** プレビューのみに入る直前のモード。プレビュー解除時にここへ戻る */
type EditMode = "editor" | "split";

export interface ViewModeState {
  mode: ViewMode;
  lastEditMode: EditMode;
}

export function createViewModeState(): ViewModeState {
  return { mode: "split", lastEditMode: "split" };
}

/** 「横にプレビューを開く」(VSCode Ctrl+K V 相当): editor ⇔ split をトグルする */
export function toggleSplit(state: ViewModeState): ViewModeState {
  const mode = state.mode === "split" ? "editor" : "split";
  return { mode, lastEditMode: mode };
}

/**
 * 「プレビューとして開く」(VSCode Ctrl+Shift+V 相当): preview ⇔ 直前の編集モードをトグルする。
 * editor/split から呼ぶと preview に入り、そのときのモードを lastEditMode に記録する。
 */
export function togglePreview(state: ViewModeState): ViewModeState {
  if (state.mode === "preview") {
    return { mode: state.lastEditMode, lastEditMode: state.lastEditMode };
  }
  return { mode: "preview", lastEditMode: state.mode };
}

/** メニューからの直接指定。preview 以外を指定したときは lastEditMode も更新する */
export function setMode(state: ViewModeState, mode: ViewMode): ViewModeState {
  if (mode === "preview") {
    return { mode, lastEditMode: state.lastEditMode };
  }
  return { mode, lastEditMode: mode };
}

/** Ctrl+K V のコード入力(2打鍵)の待機状態 */
export type ChordState = "pending";
type ChordResult = "pending" | "fire" | "idle";

/**
 * コード入力の1ステップを進める。
 * 待機中でないときに 'k' を受けたら pending へ、pending 中に 'v' を受けたら fire、
 * それ以外は idle(待機解除、または何も起きない)。
 */
export function advanceChord(current: ChordState | undefined, key: string): ChordResult {
  if (current === "pending") {
    if (key === "v") return "fire";
    if (key === "k") return "pending";
    return "idle";
  }
  return key === "k" ? "pending" : "idle";
}
