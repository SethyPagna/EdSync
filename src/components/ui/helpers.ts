const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export function joinIds(...ids: Array<string | undefined>): string | undefined {
  return ids.filter(Boolean).join(" ") || undefined;
}

export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest('[contenteditable]:not([contenteditable="false"]), [role="textbox"]') !== null;
}

export function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
}

export type Hotkey = {
  key: string;
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
};

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  space: " ",
  spacebar: " ",
  del: "delete",
  return: "enter",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  plus: "+",
};

export function parseHotkey(combo: string): Hotkey[] {
  return combo
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const tokens = part.toLowerCase().split("+").map((token) => token.trim());
      let key = tokens.pop() ?? "";
      if (key === "" && tokens.at(-1) === "") {
        tokens.pop();
        key = "+";
      }
      const hotkey: Hotkey = {
        key: KEY_ALIASES[key] ?? key,
        mod: false,
        ctrl: false,
        meta: false,
        alt: false,
        shift: false,
      };
      for (const token of tokens) {
        if (token === "mod") hotkey.mod = true;
        else if (token === "ctrl" || token === "control") hotkey.ctrl = true;
        else if (token === "meta" || token === "cmd" || token === "command") hotkey.meta = true;
        else if (token === "alt" || token === "option") hotkey.alt = true;
        else if (token === "shift") hotkey.shift = true;
      }
      return hotkey;
    });
}

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

function matchesParsed(event: KeyLike, hotkey: Hotkey, isMac: boolean): boolean {
  if (typeof event.key !== "string") return false;
  const wantMeta = hotkey.meta || (hotkey.mod && isMac);
  const wantCtrl = hotkey.ctrl || (hotkey.mod && !isMac);
  if (event.metaKey !== wantMeta || event.ctrlKey !== wantCtrl || event.altKey !== hotkey.alt) {
    return false;
  }
  const isSymbol = hotkey.key.length === 1 && !/[a-z0-9]/.test(hotkey.key);
  if (!isSymbol && event.shiftKey !== hotkey.shift) return false;
  const key = event.key.toLowerCase();
  if (key === hotkey.key) return true;
  if (/^[a-z]$/.test(hotkey.key)) return event.code === `Key${hotkey.key.toUpperCase()}`;
  if (/^[0-9]$/.test(hotkey.key)) return event.code === `Digit${hotkey.key}`;
  return false;
}

export function matchesHotkey(
  event: KeyLike,
  combo: string | Hotkey[],
  isMac: boolean = detectMac(),
): boolean {
  const hotkeys = typeof combo === "string" ? parseHotkey(combo) : combo;
  return hotkeys.some((hotkey) => matchesParsed(event, hotkey, isMac));
}

const KEY_LABELS: Record<string, string> = {
  escape: "Esc",
  " ": "Space",
  enter: "↵",
  backspace: "⌫",
  delete: "Del",
  tab: "Tab",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

export function formatHotkey(combo: string, isMac: boolean): string {
  const [hotkey] = parseHotkey(combo);
  if (!hotkey) return "";
  const keyLabel =
    KEY_LABELS[hotkey.key] ??
    (hotkey.key.length === 1 ? hotkey.key.toUpperCase() : hotkey.key.charAt(0).toUpperCase() + hotkey.key.slice(1));
  const parts: string[] = [];
  if (hotkey.ctrl || (hotkey.mod && !isMac)) parts.push(isMac ? "⌃" : "Ctrl");
  if (hotkey.alt) parts.push(isMac ? "⌥" : "Alt");
  if (hotkey.shift) parts.push(isMac ? "⇧" : "Shift");
  if (hotkey.meta || (hotkey.mod && isMac)) parts.push(isMac ? "⌘" : "Win");
  parts.push(keyLabel);
  return parts.join(isMac ? "" : "+");
}

export function rovingIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export function tabPanelProps(idPrefix: string, value: string) {
  return {
    role: "tabpanel" as const,
    id: `${idPrefix}-panel-${value}`,
    "aria-labelledby": `${idPrefix}-tab-${value}`,
    tabIndex: 0,
  };
}

export function isPathActive(pathname: string, href: string): boolean {
  const base = href.split(/[?#]/)[0] || "/";
  if (pathname === base) return true;
  if (base === "/") return false;
  return pathname.startsWith(base.endsWith("/") ? base : `${base}/`);
}

export function activeHref(pathname: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (isPathActive(pathname, href) && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
