import type { HTMLElement } from "linkedom";
import type { NodeHtmlMarkdown } from "node-html-markdown-cloudflare";
import sanitizeHtml from "sanitize-html";

// html tags (and their children) to remove from the DOM
const REMOVED_TAGS = ["nav", "form", "footer"];
// html tags (but not their children) to erase from the DOM
const IGNORED_TAGS = ["table"]; // table doesn't work well with node-html-markdown

export function htmlToMarkdown(
  node: HTMLElement | string,
  nhm: NodeHtmlMarkdown,
): string {
  if (!node) {
    return "";
  }
  let dirtyHtml;
  if (typeof node === "string") {
    dirtyHtml = node;
  } else {
    // create a copy of the DOM tree to avoid mutating original
    const container = node.cloneNode(true);
    // remove unwanted children
    container
      .querySelectorAll(REMOVED_TAGS.join(","))
      .forEach((el: HTMLElement) => {
        el.parentNode.removeChild(el);
      });
    dirtyHtml = container.innerHTML;
  }
  // sanitize remaining html
  const cleanHtml = sanitizeHtml(dirtyHtml, {
    // https://www.npmjs.com/package/sanitize-html#default-options
    allowedTags: sanitizeHtml.defaults.allowedTags.filter(
      (tag) => !IGNORED_TAGS.includes(tag),
    ),
  });
  // convert to markdown
  return nhm.translate(cleanHtml).trim();
}
