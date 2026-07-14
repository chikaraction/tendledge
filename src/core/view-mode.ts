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

/**
 * ヘルプタブ(読み取り専用の組み込み文書)へ入るときのモード強制。
 * 常にプレビューのみで表示する。preview 以外から入った場合は、
 * 離れるときに戻すためのモードを restoreTo として返す。
 */
export function enterHelpMode(state: ViewModeState): {
  state: ViewModeState;
  restoreTo: EditMode | undefined;
} {
  const mode = state.mode;
  if (mode === "preview") return { state, restoreTo: undefined };
  return { state: { mode: "preview", lastEditMode: mode }, restoreTo: mode };
}

/**
 * ヘルプタブから通常タブへ戻るときのモード復元。
 * ヘルプ表示中にユーザーが手動でモードを変えていた場合(preview 以外)は
 * その選択を尊重して上書きしない。
 */
export function leaveHelpMode(
  state: ViewModeState,
  restoreTo: EditMode | undefined,
): ViewModeState {
  if (restoreTo === undefined || state.mode !== "preview") return state;
  return { mode: restoreTo, lastEditMode: restoreTo };
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
