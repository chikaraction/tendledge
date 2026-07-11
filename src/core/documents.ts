// タブ = ドキュメントの状態管理(純粋ロジック。DOM / CodeMirror に依存しない)
//
// エディタ本体(EditorState)の保持は ui 層の責務。ここでは
// 「どのファイルがどの順で開いていて、どれがアクティブで、どれが未保存か」だけを扱う。
//
// 不変条件: ドキュメントは常に 1 つ以上存在し、必ず 1 つがアクティブである。
// (最後のタブを閉じたら空の Untitled を自動生成してこの不変条件を守る)

import { basename } from "./paths";

export interface DocumentInfo {
  /** ストア内で一意な ID(連番。パスとは独立) */
  readonly id: number;
  /** 保存先のフルパス。undefined = Untitled(未保存の新規文書) */
  readonly path: string | undefined;
  /** 現在の内容(dirty 判定用に ui 層から同期される) */
  readonly content: string;
}

/** タブ表示用のラベル。path があればファイル名、なければ "Untitled"。 */
export function documentLabel(doc: Pick<DocumentInfo, "path">): string {
  return doc.path ? basename(doc.path) : "Untitled";
}

export interface OpenFileResult {
  doc: DocumentInfo;
  /** true なら既存タブをアクティブ化しただけ(新タブは作っていない) */
  alreadyOpen: boolean;
}

export interface DocumentStore {
  list(): readonly DocumentInfo[];
  activeDoc(): DocumentInfo;
  isDirty(id: number): boolean;
  /** いずれかのタブに未保存の変更があるか(ウィンドウクローズ時の確認に使う) */
  hasDirty(): boolean;
  /** 空の Untitled タブを末尾に追加してアクティブにする */
  openUntitled(): DocumentInfo;
  /** ファイルをタブとして開く。同じ path が開いていれば既存タブをアクティブ化する */
  openFile(path: string, content: string): OpenFileResult;
  /**
   * エディタでの編集内容を反映する(dirty 判定が更新される)。
   * 戻り値は「呼び出し前後で isDirty が変化したか」(タブバー再描画の要否判定に使う)。
   */
  updateContent(id: number, content: string): boolean;
  /** 保存を記録する。path を渡すと「名前を付けて保存」(Untitled → パス付き) */
  markSaved(id: number, content: string, path?: string): void;
  activate(id: number): void;
  /** 次のタブへ循環切り替え(Ctrl+Tab) */
  activateNext(): void;
  /** タブを閉じる。dirty 確認は呼び出し側の責務 */
  close(id: number): void;
}

interface DocumentRecord {
  id: number;
  path: string | undefined;
  content: string;
  lastSavedContent: string;
}

export function createDocumentStore(opts: { initialContent: string }): DocumentStore {
  let nextId = 1;
  const docs: DocumentRecord[] = [];
  let activeId: number;

  function createDoc(path: string | undefined, content: string): DocumentRecord {
    const doc: DocumentRecord = { id: nextId++, path, content, lastSavedContent: content };
    docs.push(doc);
    return doc;
  }

  function find(id: number): DocumentRecord | undefined {
    return docs.find((d) => d.id === id);
  }

  function toInfo(doc: DocumentRecord): DocumentInfo {
    return { id: doc.id, path: doc.path, content: doc.content };
  }

  // 初期ドキュメント(サンプル文書は保存済み扱いで dirty にしない)
  activeId = createDoc(undefined, opts.initialContent).id;

  return {
    list() {
      return docs.map(toInfo);
    },
    activeDoc() {
      return toInfo(find(activeId)!);
    },
    isDirty(id) {
      const doc = find(id);
      return doc !== undefined && doc.content !== doc.lastSavedContent;
    },
    hasDirty() {
      return docs.some((d) => d.content !== d.lastSavedContent);
    },
    openUntitled() {
      const doc = createDoc(undefined, "");
      activeId = doc.id;
      return toInfo(doc);
    },
    openFile(path, content) {
      const existing = docs.find((d) => d.path === path);
      if (existing) {
        activeId = existing.id;
        return { doc: toInfo(existing), alreadyOpen: true };
      }
      const doc = createDoc(path, content);
      activeId = doc.id;
      return { doc: toInfo(doc), alreadyOpen: false };
    },
    updateContent(id, content) {
      const doc = find(id);
      if (!doc) return false;
      const wasDirty = doc.content !== doc.lastSavedContent;
      doc.content = content;
      const isDirtyNow = doc.content !== doc.lastSavedContent;
      return wasDirty !== isDirtyNow;
    },
    markSaved(id, content, path) {
      const doc = find(id);
      if (!doc) return;
      doc.content = content;
      doc.lastSavedContent = content;
      if (path !== undefined) doc.path = path;
    },
    activate(id) {
      if (find(id)) activeId = id;
    },
    activateNext() {
      const index = docs.findIndex((d) => d.id === activeId);
      activeId = docs[(index + 1) % docs.length].id;
    },
    close(id) {
      const index = docs.findIndex((d) => d.id === id);
      if (index === -1) return;
      docs.splice(index, 1);
      if (docs.length === 0) {
        // 不変条件: タブは常に 1 つ以上。空の Untitled を補充する
        activeId = createDoc(undefined, "").id;
        return;
      }
      if (activeId === id) {
        // 右隣(なければ左隣 = 新しい右端)をアクティブにする
        activeId = docs[Math.min(index, docs.length - 1)].id;
      }
    },
  };
}
