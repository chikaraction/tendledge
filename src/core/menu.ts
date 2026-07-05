// メニューバーの開閉状態(純粋ロジック。DOM に依存しない)
//
// Windows のメニューバー標準挙動:
// - クリックで開閉(同じメニューの再クリックは閉じる)
// - どこかが開いている間は、別メニューにホバーするだけで切り替わる
// - 項目選択・Esc・外側クリックで閉じる(close は ui 層が配線する)

export interface MenubarState {
  /** 開いているメニューの id。閉じていれば undefined */
  openMenuId(): string | undefined;
  /** クリック: 開閉をトグルする(別メニューなら切り替え) */
  toggle(id: string): void;
  /** ホバー: どこかが開いているときだけ切り替える */
  hoverTo(id: string): void;
  close(): void;
}

export function createMenubarState(): MenubarState {
  let openId: string | undefined;

  return {
    openMenuId() {
      return openId;
    },
    toggle(id) {
      openId = openId === id ? undefined : id;
    },
    hoverTo(id) {
      if (openId !== undefined) openId = id;
    },
    close() {
      openId = undefined;
    },
  };
}
