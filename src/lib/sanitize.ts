import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "img",
      "figure", "figcaption", "hr", "span", "div",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "class"],
  });
}
