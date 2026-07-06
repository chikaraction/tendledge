// プレビュー内リンクの分類(純粋ロジック)
//
// プレビューの <a> クリックをそのまま WebView に遷移させると、相対リンクで
// アプリごと初期表示に戻ってしまう。クリックをどう扱うべきかの判断だけを
// ここで行い、実際の遷移・タブ操作・外部起動は ui / main 側の責務。

import { dirname, resolvePath } from "./paths";
import { isSupportedFile } from "./vault-tree";

export type PreviewLinkAction =
  | { kind: "external"; url: string } // システムブラウザ等で開く
  | { kind: "anchor"; id: string } // プレビューペイン内スクロール
  | { kind: "open-file"; path: string } // エディタのタブとして開く
  | { kind: "none" }; // 何もしない(遷移の抑止のみ)

/** システム側に委ねてよいスキーム(opener プラグインの既定許可と揃える) */
const EXTERNAL_SCHEMES = /^(?:https?|mailto|tel):/i;

/** スキームらしき接頭辞(file: など上記以外は安全側に倒して無視する) */
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function classifyPreviewLink(
  href: string | null,
  currentDocPath: string | undefined,
): PreviewLinkAction {
  if (!href) return { kind: "none" };

  if (href.startsWith("#")) {
    const id = href.slice(1);
    return id ? { kind: "anchor", id } : { kind: "none" };
  }

  if (EXTERNAL_SCHEMES.test(href)) return { kind: "external", url: href };
  if (ANY_SCHEME.test(href)) return { kind: "none" };

  // ここまで来たら相対パス。現在の文書が保存済み(パスを持つ)場合のみ解決できる。
  if (!currentDocPath) return { kind: "none" };
  const pathPart = href.split("#")[0];
  if (!pathPart) return { kind: "none" };

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathPart);
  } catch {
    decoded = pathPart; // 不正なエンコードはそのまま扱う
  }
  if (!isSupportedFile(decoded)) return { kind: "none" };

  return { kind: "open-file", path: resolvePath(dirname(currentDocPath), decoded) };
}
