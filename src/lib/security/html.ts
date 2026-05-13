const BLOCKED_TAGS =
  /<\/?(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option|svg|math)[^>]*>/gi;

const EVENT_HANDLER_ATTRS = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URLS = /\s+(href|src|xlink:href)\s*=\s*("|')?\s*(javascript:|data:text\/html|vbscript:)[^"'\s>]*/gi;
const DANGEROUS_STYLE = /\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const DATA_ATTRS = /\s+data-[a-z0-9_-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

export function sanitizeHtml(input: string) {
  return input
    .replace(BLOCKED_TAGS, "")
    .replace(EVENT_HANDLER_ATTRS, "")
    .replace(DANGEROUS_URLS, "")
    .replace(DANGEROUS_STYLE, "")
    .replace(DATA_ATTRS, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}
