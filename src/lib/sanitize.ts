import sanitizeHtmlLib from "sanitize-html";
import { mediaUrl } from "./media-url";

export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: [
      "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "img",
      "figure", "figcaption", "hr", "span", "div",
    ],
    allowedAttributes: {
      "*": ["class", "title"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, src: mediaUrl(attribs.src) || attribs.src },
      }),
    },
  });
}
