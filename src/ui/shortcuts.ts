// アプリ全体のキーボードショートカット(Ctrl+キー)
import { advanceChord, type ChordState } from "../core/view-mode";

export interface ShortcutHandlers {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPrint: () => void;
  onCloseTab: () => void;
  onNextTab: () => void;
  /** 「横にプレビューを開く」(Ctrl+K V) */
  onToggleSplit: () => void;
  /** 「プレビューとして開く」(Ctrl+Shift+V) */
  onTogglePreview: () => void;
  /**
   * Ctrl+F。true を返すとここで preventDefault してブラウザ/WebView のネイティブ検索を
   * 抑止する(呼び出し側でエディタの検索パネルを開いた場合)。false ならネイティブ検索に任せる
   * (プレビューのみ表示中など)。
   */
  onFind: () => boolean;
}

// Ctrl+K の後に次のキーを待つ猶予(ms)。この間に V が来なければコードを解除する。
const CHORD_TIMEOUT_MS = 1500;

export function setupShortcuts(handlers: ShortcutHandlers): void {
  let chordState: ChordState | undefined;
  let chordTimer: ReturnType<typeof setTimeout> | undefined;

  function resetChord(): void {
    chordState = undefined;
    clearTimeout(chordTimer);
  }

  window.addEventListener("keydown", (e) => {
    // e.altKey も見て除外するのは、Windows では AltGr+キー(欧州系レイアウトで文字入力に
    // 使われる)が ctrlKey: true, altKey: true として届くため。これを弾かないと
    // 例えば AltGr+F で Ctrl+F 相当が誤発火し、文字入力を潰してしまう。
    if (!e.ctrlKey || e.altKey) {
      resetChord();
      return;
    }
    const key = e.key.toLowerCase();

    const chordResult = advanceChord(chordState, key);
    if (chordResult === "pending") {
      e.preventDefault();
      chordState = "pending";
      clearTimeout(chordTimer);
      chordTimer = setTimeout(resetChord, CHORD_TIMEOUT_MS);
      return;
    }
    if (chordResult === "fire") {
      e.preventDefault();
      resetChord();
      handlers.onToggleSplit();
      return;
    }
    resetChord();

    if (key === "n") {
      e.preventDefault();
      handlers.onNew();
    } else if (key === "o") {
      e.preventDefault();
      handlers.onOpen();
    } else if (key === "s" && e.shiftKey) {
      e.preventDefault();
      handlers.onSaveAs();
    } else if (key === "s") {
      e.preventDefault();
      handlers.onSave();
    } else if (key === "p") {
      e.preventDefault();
      handlers.onPrint();
    } else if (key === "w") {
      e.preventDefault();
      handlers.onCloseTab();
    } else if (key === "tab") {
      e.preventDefault();
      handlers.onNextTab();
    } else if (key === "v" && e.shiftKey) {
      e.preventDefault();
      handlers.onTogglePreview();
    } else if (key === "f" && !e.shiftKey) {
      if (handlers.onFind()) {
        e.preventDefault();
      }
    }
  });
}
