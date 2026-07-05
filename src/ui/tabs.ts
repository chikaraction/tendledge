// タブバーの描画(状態は core/documents.ts が持ち、ここは表示とイベントだけ)
import type { DocumentInfo } from "../core/documents";
import { basename } from "../core/paths";

export interface TabsHandlers {
  onActivate(id: number): void;
  onClose(id: number): void;
}

export function renderTabs(
  container: HTMLElement,
  docs: readonly DocumentInfo[],
  activeId: number,
  isDirty: (id: number) => boolean,
  handlers: TabsHandlers,
): void {
  container.replaceChildren(
    ...docs.map((doc) => {
      const tab = document.createElement("div");
      tab.className = "tab";
      tab.classList.toggle("active", doc.id === activeId);
      if (doc.path) tab.title = doc.path;

      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = doc.path ? basename(doc.path) : "Untitled";
      tab.appendChild(label);

      const dirty = document.createElement("span");
      dirty.className = "tab-dirty";
      dirty.classList.toggle("visible", isDirty(doc.id));
      tab.appendChild(dirty);

      const close = document.createElement("button");
      close.className = "tab-close";
      close.textContent = "×";
      close.title = "閉じる (Ctrl+W)";
      close.addEventListener("click", (e) => {
        e.stopPropagation(); // タブのアクティブ化を発火させない
        handlers.onClose(doc.id);
      });
      tab.appendChild(close);

      tab.addEventListener("click", () => handlers.onActivate(doc.id));
      return tab;
    }),
  );
}
