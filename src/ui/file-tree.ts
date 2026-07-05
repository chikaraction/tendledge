// サイドバーのファイルツリー表示。
// ツリーの構築ロジックは core/vault-tree.ts、ここは DOM 描画と展開状態の管理だけ。
import type { VaultNode } from "../core/vault-tree";

export interface FileTreeController {
  /** ツリーを差し替えて再描画する(保管庫を開いた / 再読込したとき) */
  setTree(tree: VaultNode[]): void;
  /** アクティブなファイルのハイライトを更新する(タブ切替時) */
  setActivePath(path: string | undefined): void;
}

export function createFileTree(
  container: HTMLElement,
  onOpenFile: (path: string) => void,
): FileTreeController {
  let tree: VaultNode[] = [];
  let activePath: string | undefined;
  // 再描画してもフォルダの開閉状態が失われないよう、展開中のパスを覚えておく
  const expandedDirs = new Set<string>();

  function renderNode(node: VaultNode): HTMLElement {
    if (node.kind === "dir") {
      const details = document.createElement("details");
      details.className = "tree-dir";
      details.open = expandedDirs.has(node.path);
      details.addEventListener("toggle", () => {
        if (details.open) expandedDirs.add(node.path);
        else expandedDirs.delete(node.path);
      });

      const summary = document.createElement("summary");
      summary.textContent = node.name;
      details.appendChild(summary);

      const childrenEl = document.createElement("div");
      childrenEl.className = "tree-children";
      for (const child of node.children ?? []) {
        childrenEl.appendChild(renderNode(child));
      }
      details.appendChild(childrenEl);
      return details;
    }

    const file = document.createElement("button");
    file.className = "tree-file";
    file.classList.toggle("active", node.path === activePath);
    file.textContent = node.name;
    file.title = node.path;
    file.addEventListener("click", () => onOpenFile(node.path));
    return file;
  }

  function render(): void {
    container.replaceChildren(...tree.map(renderNode));
  }

  return {
    setTree(next) {
      tree = next;
      render();
    },
    setActivePath(path) {
      activePath = path;
      render();
    },
  };
}
