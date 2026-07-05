// カスタム HTML メニューバー(ツールバーの置き換え)。
// 開閉のルールは core/menu.ts(純粋ロジック)が持ち、ここは DOM 描画とイベントだけ。
// Tauri のネイティブメニューではなくカスタム実装にする理由は
// docs/design-direction.md 参照(テーマ追従・ブラウザプレビューで検証可能)。
import { createMenubarState } from "../core/menu";

export interface MenuItemDef {
  label: string;
  /** 右端に表示するショートカット表記(例: "Ctrl+N") */
  shortcut?: string;
  onSelect: () => void;
  /** チェックマーク表示(テーマ選択・サイドバー表示状態など) */
  checked?: () => boolean;
}

export type MenuEntryDef = MenuItemDef | "separator";

export interface MenuDef {
  id: string;
  label: string;
  entries: MenuEntryDef[];
}

export interface MenubarController {
  /** チェック状態などの表示を更新する(設定変更後に呼ぶ) */
  refresh(): void;
}

export function createMenubar(container: HTMLElement, menus: MenuDef[]): MenubarController {
  const state = createMenubarState();
  const buttons = new Map<string, HTMLButtonElement>();
  const dropdowns = new Map<string, HTMLElement>();

  function renderDropdown(menu: MenuDef, dropdown: HTMLElement): void {
    dropdown.replaceChildren(
      ...menu.entries.map((entry) => {
        if (entry === "separator") {
          const hr = document.createElement("hr");
          hr.className = "menu-separator";
          return hr;
        }
        const item = document.createElement("button");
        item.className = "menu-item";
        item.setAttribute("role", "menuitem");

        const check = document.createElement("span");
        check.className = "menu-check";
        check.textContent = entry.checked?.() ? "✓" : "";
        item.appendChild(check);

        const label = document.createElement("span");
        label.className = "menu-label";
        label.textContent = entry.label;
        item.appendChild(label);

        if (entry.shortcut) {
          const shortcut = document.createElement("span");
          shortcut.className = "menu-shortcut";
          shortcut.textContent = entry.shortcut;
          item.appendChild(shortcut);
        }

        item.addEventListener("click", (e) => {
          e.stopPropagation();
          state.close();
          sync();
          entry.onSelect();
        });
        return item;
      }),
    );
  }

  /** state の内容を DOM(開いているドロップダウン・ボタンの見た目)に反映する */
  function sync(): void {
    const openId = state.openMenuId();
    for (const menu of menus) {
      const button = buttons.get(menu.id)!;
      const dropdown = dropdowns.get(menu.id)!;
      const isOpen = menu.id === openId;
      button.classList.toggle("open", isOpen);
      button.setAttribute("aria-expanded", String(isOpen));
      dropdown.hidden = !isOpen;
      if (isOpen) renderDropdown(menu, dropdown); // 開くたびに checked() を評価し直す
    }
  }

  for (const menu of menus) {
    const wrapper = document.createElement("div");
    wrapper.className = "menu";

    const button = document.createElement("button");
    button.className = "menu-button";
    button.textContent = menu.label;
    button.setAttribute("aria-haspopup", "menu");
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      state.toggle(menu.id);
      sync();
    });
    button.addEventListener("pointerenter", () => {
      if (state.openMenuId() !== undefined && state.openMenuId() !== menu.id) {
        state.hoverTo(menu.id);
        sync();
      }
    });

    const dropdown = document.createElement("div");
    dropdown.className = "menu-dropdown";
    dropdown.setAttribute("role", "menu");
    dropdown.hidden = true;

    wrapper.append(button, dropdown);
    container.appendChild(wrapper);
    buttons.set(menu.id, button);
    dropdowns.set(menu.id, dropdown);
  }

  // 外側クリックと Esc で閉じる
  window.addEventListener("click", () => {
    if (state.openMenuId() !== undefined) {
      state.close();
      sync();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.openMenuId() !== undefined) {
      state.close();
      sync();
    }
  });

  return {
    refresh: sync,
  };
}
