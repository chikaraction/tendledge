// チェックリスト(* [x] / * [ ])の先頭グリフをチェックボックスに置き換える処理。
// Asciidoctor.js は ✓(U+2713)/ ❏(U+2751)の文字を出すだけで、❏ は影付きの
// グリフで違和感があり、完了側もチェックボックスには見えないため。
// ライブプレビュー(preview.ts)とスタンドアロン HTML エクスポート(html-export.ts)の
// 両方から使う。

const CHECK_GLYPHS: Record<string, boolean> = {
  "✓": true, // ✓(&#10003;)
  "❏": false, // ❏(&#10063;)
};

/** root は生きたプレビュー DOM でも、DOMParser で作った別ドキュメントでも構わない */
export function decorateChecklists(root: ParentNode): void {
  const doc = root instanceof Document ? root : root.ownerDocument;
  if (!doc) return;
  const items = root.querySelectorAll<HTMLElement>("ul.checklist > li > p");
  items.forEach((p) => {
    const text = p.firstChild;
    if (text?.nodeType !== Node.TEXT_NODE || !text.textContent) return;
    const glyph = text.textContent[0];
    if (!(glyph in CHECK_GLYPHS)) return;
    text.textContent = text.textContent.slice(1).trimStart();
    const box = doc.createElement("input");
    box.type = "checkbox";
    box.disabled = true;
    // .checked はシリアライズ(outerHTML)時に checked 属性へ反映されないため、
    // 静的 HTML として書き出すエクスポートでは defaultChecked を使う必要がある
    // (ライブプレビューの見た目は .checked と同じ挙動になる)
    box.defaultChecked = CHECK_GLYPHS[glyph];
    box.className = "task-checkbox";
    p.prepend(box);
  });
}
