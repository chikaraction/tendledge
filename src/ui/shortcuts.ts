// アプリ全体のキーボードショートカット(Ctrl+キー)
export interface ShortcutHandlers {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onPrint: () => void;
  onCloseTab: () => void;
  onNextTab: () => void;
}

export function setupShortcuts(handlers: ShortcutHandlers): void {
  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey) return;
    const key = e.key.toLowerCase();
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
    }
  });
}
