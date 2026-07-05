// ステータスバー(下端の常時表示)。
// 文字数の算出は core/doc-stats.ts(純粋関数)に委譲し、ここは表示だけを担う。
import { countCharacters, formatCharCount } from "../core/doc-stats";

export interface StatusbarController {
  /** カーソル位置(1 始まりの行・列)を表示する */
  setCursor(line: number, col: number): void;
  /** 文書テキストから文字数表示を更新する */
  setDocText(text: string): void;
  /** 保管庫名を表示する(undefined で非表示) */
  setVaultName(name: string | undefined): void;
  /** 変換時間表示用の要素(preview に渡す) */
  readonly convertStatusEl: HTMLElement;
}

export function createStatusbar(container: HTMLElement): StatusbarController {
  const vaultEl = document.createElement("span");
  vaultEl.id = "statusbar-vault";

  const spacer = document.createElement("span");
  spacer.className = "statusbar-spacer";

  const cursorEl = document.createElement("span");
  cursorEl.id = "statusbar-cursor";

  const charsEl = document.createElement("span");
  charsEl.id = "statusbar-chars";

  const convertStatusEl = document.createElement("span");
  convertStatusEl.id = "status";
  convertStatusEl.title = "変換にかかった時間";

  container.append(vaultEl, spacer, cursorEl, charsEl, convertStatusEl);

  return {
    setCursor(line, col) {
      cursorEl.textContent = `行 ${line}, 列 ${col}`;
    },
    setDocText(text) {
      charsEl.textContent = formatCharCount(countCharacters(text));
    },
    setVaultName(name) {
      vaultEl.textContent = name ?? "";
      vaultEl.title = name ?? "";
    },
    convertStatusEl,
  };
}
