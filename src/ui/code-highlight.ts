// コードブロックのシンタックスハイライト。ライブプレビュー(preview.ts)と
// スタンドアロン HTML エクスポート(html-export.ts)の両方から使う共通ロジック。
//
// Asciidoctor.js のデフォルト出力は `source-highlighter` 属性なしでも
// `<pre class="highlight"><code class="language-xxx" data-lang="xxx">` と
// 言語クラス付きで出るため、その data-lang を読んで自前で色付けする方式にした
// (source-highlighter: highlight.js 属性は standalone 出力に cdnjs の
// highlight.js 9.x を注入する実装で、オフライン要件に反するため使わない)。
//
// バンドル肥大を避けるため highlight.js のフルビルドではなく lib/core +
// 対応言語モジュールの個別登録方式にする。
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { resolveHighlightLanguage, type SupportedLanguage } from "../core/highlight-lang";

const LANGUAGE_MODULES: Record<SupportedLanguage, Parameters<typeof hljs.registerLanguage>[1]> = {
  javascript,
  typescript,
  json,
  xml,
  css,
  bash,
  python,
  java,
  c,
  cpp,
  csharp,
  go,
  rust,
  ruby,
  sql,
  yaml,
  ini,
  diff,
  dockerfile,
  kotlin,
};

let registered = false;

function ensureLanguagesRegistered(): void {
  if (registered) return;
  for (const [name, fn] of Object.entries(LANGUAGE_MODULES)) {
    hljs.registerLanguage(name, fn);
  }
  registered = true;
}

/**
 * root 配下のコードブロックをハイライトする。root は生きたプレビュー DOM でも、
 * DOMParser で作った別ドキュメントでも構わない。
 * data-lang が未対応言語・欠落のブロックはプレーン表示のまま変更しない。
 * 入力はサニタイズ済み DOM の textContent のみで、hljs はそれをエスケープした
 * 上で span を生成するため、パススルー由来の生 HTML が復活する経路はない。
 */
export function decorateCodeBlocks(root: ParentNode): void {
  const codes = root.querySelectorAll<HTMLElement>("pre.highlight > code[data-lang]");
  if (codes.length === 0) return;
  ensureLanguagesRegistered();
  codes.forEach((code) => {
    const language = resolveHighlightLanguage(code.getAttribute("data-lang"));
    if (!language) return;
    const { value } = hljs.highlight(code.textContent ?? "", { language });
    code.innerHTML = value;
    code.classList.add("hljs");
  });
}
