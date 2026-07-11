// 確認・通知ダイアログの共通ヘルパー。
//
// Tauri 実機(WebView2/wry)では window.confirm / window.alert がダイアログを
// 表示せずサイレントに素通りする(wry が JS ネイティブダイアログ未実装)。
// ブラウザプレビューでは動くため実機まで発覚しなかった M14 の実機バグの原因。
// 実機では @tauri-apps/plugin-dialog の confirm / message(OS ネイティブダイアログ)を
// 使い、ブラウザプレビューでは従来どおり window.confirm / window.alert に
// フォールバックする。
import { isTauri } from "@tauri-apps/api/core";
import { confirm, message } from "@tauri-apps/plugin-dialog";

/** OK / キャンセルの確認。OK なら true(window.confirm の非同期版) */
export async function confirmDialog(text: string, title?: string): Promise<boolean> {
  if (isTauri()) {
    return confirm(text, { title, kind: "warning" });
  }
  return window.confirm(text);
}

/** エラー通知(window.alert の非同期版) */
export async function alertDialog(text: string, title?: string): Promise<void> {
  if (isTauri()) {
    await message(text, { title, kind: "error" });
    return;
  }
  window.alert(text);
}
