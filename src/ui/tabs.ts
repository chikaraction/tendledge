// タブバーの描画(状態は core/documents.ts が持ち、ここは表示とイベントだけ)
import type { DocumentInfo } from "../core/documents";
import { basename } from "../core/paths";
import { icon, icons } from "./icons";

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
      close.appendChild(icon(icons.close, 12));
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

/** タブ一覧ポップアップの1項目分の表示情報 */
export interface TabListItem {
  id: number;
  label: string;
  active: boolean;
  dirty: boolean;
}

export interface TabOverflowController {
  /** renderTabs の後に呼ぶ。溢れ判定の更新とアクティブタブの追従を行う */
  update(): void;
}

/**
 * タブバーの溢れ対応。タブが1段に収まらないときだけ、
 * 左右送りボタンとタブ一覧ボタンを表示する(スクロールバーは常に出さない)。
 * ホイールの縦回転は横スクロールに読み替え、アクティブタブは切替時に必ず見える位置へ送る。
 */
export function setupTabOverflow(
  tabbarEl: HTMLElement,
  tabsEl: HTMLElement,
  getTabList: () => TabListItem[],
  onSelect: (id: number) => void,
): TabOverflowController {
  tabsEl.addEventListener(
    "wheel",
    (e) => {
      if (tabsEl.scrollWidth <= tabsEl.clientWidth) return;
      e.preventDefault();
      tabsEl.scrollLeft += e.deltaY + e.deltaX;
    },
    { passive: false },
  );

  function scrollStep(direction: -1 | 1): void {
    tabsEl.scrollBy({
      left: direction * Math.max(120, tabsEl.clientWidth * 0.6),
      behavior: "smooth",
    });
  }

  const leftBtn = document.createElement("button");
  leftBtn.className = "tabbar-action tab-scroll";
  leftBtn.title = "タブを左へスクロール";
  leftBtn.appendChild(icon(icons.chevronLeft, 14));
  leftBtn.addEventListener("click", () => scrollStep(-1));

  const rightBtn = document.createElement("button");
  rightBtn.className = "tabbar-action tab-scroll";
  rightBtn.title = "タブを右へスクロール";
  rightBtn.appendChild(icon(icons.chevron, 14));
  rightBtn.addEventListener("click", () => scrollStep(1));

  // タブ一覧(メニューバーのドロップダウンと同じ見た目を流用する)
  const listWrap = document.createElement("span");
  listWrap.className = "tab-list-menu";
  const listBtn = document.createElement("button");
  listBtn.className = "tabbar-action tab-scroll";
  listBtn.title = "タブ一覧";
  listBtn.appendChild(icon(icons.list, 14));
  listWrap.appendChild(listBtn);

  let dropdown: HTMLElement | undefined;
  function closeDropdown(): void {
    dropdown?.remove();
    dropdown = undefined;
    document.removeEventListener("pointerdown", onOutsidePointer, true);
    document.removeEventListener("keydown", onEscape);
  }
  function onOutsidePointer(e: PointerEvent): void {
    if (!listWrap.contains(e.target as Node)) closeDropdown();
  }
  function onEscape(e: KeyboardEvent): void {
    if (e.key === "Escape") closeDropdown();
  }
  listBtn.addEventListener("click", () => {
    if (dropdown) {
      closeDropdown();
      return;
    }
    dropdown = document.createElement("div");
    dropdown.className = "menu-dropdown tab-list-dropdown";
    for (const item of getTabList()) {
      const btn = document.createElement("button");
      btn.className = "menu-item";
      btn.classList.toggle("active", item.active);
      const label = document.createElement("span");
      label.className = "menu-label";
      label.textContent = item.label;
      const dirty = document.createElement("span");
      dirty.className = "tab-dirty";
      dirty.classList.toggle("visible", item.dirty);
      btn.append(label, dirty);
      btn.addEventListener("click", () => {
        closeDropdown();
        onSelect(item.id);
      });
      dropdown.appendChild(btn);
    }
    listWrap.appendChild(dropdown);
    document.addEventListener("pointerdown", onOutsidePointer, true);
    document.addEventListener("keydown", onEscape);
  });

  tabbarEl.insertBefore(leftBtn, tabsEl);
  tabsEl.after(rightBtn, listWrap);

  function update(): void {
    const overflowing = tabsEl.scrollWidth > tabsEl.clientWidth;
    leftBtn.hidden = !overflowing;
    rightBtn.hidden = !overflowing;
    listWrap.hidden = !overflowing;
    if (!overflowing) closeDropdown();
    // 切替直後のアクティブタブが隠れていたら見える位置まで送る
    tabsEl.querySelector(".tab.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  new ResizeObserver(update).observe(tabsEl);
  return { update };
}
