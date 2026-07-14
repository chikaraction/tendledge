// 著者バイライン(:author: / リビジョン情報)から Asciidoctor HTML5 コンバータ互換の
// `<div class="details">…</div>` を生成する純粋関数。DOM / Asciidoctor には依存しない
// (文字列生成のみ)。呼び出し側(ui/render.ts)が doc.getAuthors() / getRevisionNumber() 等
// から BylineInfo を組み立てる。
//
// マークアップ構造は推測せず、node_modules/@asciidoctor/core の Html5Converter
// (dist/node/asciidoctor.js の convertDocument、$header?() 配下、~L14277-14301)を
// 読んで確認し、実際に asciidoctor.convert(source, {standalone: true}) を掛けて
// 出力を突き合わせた(著者1人/複数/email あり・なし/リビジョン行/著者なし文書、
// 各パターンで実測)。要点:
// - 著者2人目以降の id は "author2" / "email2"("author_2" のようなアンダースコア連番ではない)。
// - リビジョン行は revnumber("version 1.0," の形。カンマは revdate があるときだけ)→
//   revdate → revremark(直前に単独の <br> が付く)の順。revnumber/revdate/revremark は
//   それぞれ独立に「属性があれば出す」判定(3つとも欄がなければリビジョン行自体が出ない)。
// - 著者・リビジョン情報のいずれも無ければ `<div class="details">` 自体を出さない
//   (空文字列を返す)。

/** バイラインに載せる著者1人分の情報 */
export interface BylineAuthor {
  /** 表示名(必須。空文字は呼び出し側でフィルタする想定) */
  name: string;
  /** メールアドレス(省略可) */
  email?: string;
}

/** バイラインに載せるリビジョン情報。3項目とも省略可で、それぞれ独立に表示判定する */
export interface BylineRevision {
  number?: string;
  date?: string;
  remark?: string;
}

export interface BylineInfo {
  authors: BylineAuthor[];
  revision?: BylineRevision;
}

/** Asciidoctor の specialcharacters 相当の最小限の HTML エスケープ */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 2人目以降だけ番号を付ける id サフィックス("author2" / "email2" 形式) */
function idSuffix(index: number): string {
  return index > 0 ? String(index + 1) : "";
}

/**
 * 著者・リビジョン情報から `<div class="details">…</div>` の HTML を生成する。
 * 情報が何もなければ空文字列を返す(呼び出し側は挿入をスキップできる)。
 */
export function renderBylineHtml(info: BylineInfo): string {
  const lines: string[] = [];

  info.authors.forEach((author, index) => {
    const suffix = idSuffix(index);
    lines.push(
      `<span id="author${suffix}" class="author">${escapeHtml(author.name)}</span><br>`,
    );
    if (author.email) {
      const email = escapeHtml(author.email);
      lines.push(
        `<span id="email${suffix}" class="email"><a href="mailto:${email}">${email}</a></span><br>`,
      );
    }
  });

  const revision = info.revision;
  if (revision) {
    if (revision.number) {
      const suffix = revision.date ? "," : "";
      lines.push(`<span id="revnumber">version ${escapeHtml(revision.number)}${suffix}</span>`);
    }
    if (revision.date) {
      lines.push(`<span id="revdate">${escapeHtml(revision.date)}</span>`);
    }
    if (revision.remark) {
      lines.push(`<br><span id="revremark">${escapeHtml(revision.remark)}</span>`);
    }
  }

  if (lines.length === 0) return "";

  return `<div class="details">\n${lines.join("\n")}\n</div>`;
}
