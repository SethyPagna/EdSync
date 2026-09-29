"use client";

import {
  cloneElement,
  useCallback,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";
import { useIsClient } from "./hooks";
import { PortalContainerContext, usePortalContainer } from "./portal";
import { assignRef } from "./refs";

type PopoverTriggerProps = {
  id?: string;
  ref?: Ref<HTMLElement>;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "dialog";
  "aria-controls"?: string;
};

export type PopoverAlign = "start" | "center" | "end";
export type PopoverSide = "bottom" | "top";

export type PopoverProps = {
  trigger: ReactElement<PopoverTriggerProps>;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: PopoverAlign;
  side?: PopoverSide;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  className?: string;
};

const GAP = 6;
const VIEWPORT_MARGIN = 8;
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const NESTED_LAYER = '[data-popover-content], [role="menu"]';

function placeContent(content: HTMLElement, anchor: HTMLElement, side: PopoverSide, align: PopoverAlign) {
  const anchorRect = anchor.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const below = anchorRect.bottom + GAP;
  const above = anchorRect.top - GAP - contentRect.height;
  const fitsBelow = below + contentRect.height <= viewportHeight - VIEWPORT_MARGIN;
  const fitsAbove = above >= VIEWPORT_MARGIN;
  const resolvedSide = side === "bottom" ? (!fitsBelow && fitsAbove ? "top" : "bottom") : !fitsAbove && fitsBelow ? "bottom" : "top";

  const rawTop = resolvedSide === "bottom" ? below : above;
  const top = Math.max(VIEWPORT_MARGIN, Math.min(rawTop, viewportHeight - contentRect.height - VIEWPORT_MARGIN));
  const rawLeft =
    align === "start"
      ? anchorRect.left
      : align === "end"
        ? anchorRect.right - contentRect.width
        : anchorRect.left + anchorRect.width / 2 - contentRect.width / 2;
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rawLeft, viewportWidth - contentRect.width - VIEWPORT_MARGIN));

  content.style.top = `${Math.round(top)}px`;
  content.style.left = `${Math.round(left)}px`;
  content.dataset.side = resolvedSide;
}

export function Popover({
  trigger,
  children,
  align = "start",
  side = "bottom",
  open: openProp,
  onOpenChange,
  label,
  className,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const contentId = useId();
  const generatedTriggerId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [contentNode, setContentNode] = useState<HTMLDivElement | null>(null);
  const container = usePortalContainer();
  const isClient = useIsClient();
  const triggerProps = trigger.props;
  const triggerId = triggerProps.id ?? generatedTriggerId;
  const forwardedRef = triggerProps.ref;

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) anchor?.focus();
    },
    [setOpen, anchor],
  );

  const dismiss = useEffectEvent((returnFocus: boolean) => close(returnFocus));

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!open || !content || !anchor) return;

    const place = () => placeContent(content, anchor, side, align);
    place();
    const firstFocusable = content.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? content).focus({ preventScroll: true });

    let frame = 0;
    const schedulePlace = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && (content.contains(target) || anchor.contains(target))) return;
      dismiss(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", schedulePlace);
    window.addEventListener("scroll", schedulePlace, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", schedulePlace);
      window.removeEventListener("scroll", schedulePlace, true);
    };
  }, [open, side, align, isClient, anchor]);

  const setContentRef = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    setContentNode(node);
  }, []);

  const setTriggerRef = useCallback(
    (node: HTMLElement | null) => {
      setAnchor(node);
      assignRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node)) return;
    if (event.currentTarget.contains(next) || anchor?.contains(next)) return;
    setOpen(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    const content = contentRef.current;
    if (!content || !(event.target instanceof Node) || !content.contains(event.target)) return;
    if (event.target instanceof Element && event.target.closest(NESTED_LAYER) !== content) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => !element.closest("[hidden], [inert]") &&
        getComputedStyle(element).display !== "none" &&
        getComputedStyle(element).visibility !== "hidden",
    );
    const boundary = event.shiftKey ? focusable[0] : focusable.at(-1);
    if (!boundary || event.target === boundary) {
      event.preventDefault();
      close(true);
    }
  };

  const triggerElement = cloneElement(trigger, {
    id: triggerId,
    ref: setTriggerRef,
    "aria-expanded": open,
    "aria-haspopup": "dialog",
    "aria-controls": open ? contentId : undefined,
    onClick: (event: MouseEvent<HTMLElement>) => {
      triggerProps.onClick?.(event);
      if (!event.defaultPrevented) setOpen(!open);
    },
  });

  return (
    <>
      {triggerElement}
      {open && isClient
        ? createPortal(
            <div
              ref={setContentRef}
              id={contentId}
              role="dialog"
              aria-label={label}
              aria-labelledby={label ? undefined : triggerId}
              tabIndex={-1}
              data-popover-content=""
              data-side={side}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={cn("popover fixed left-0 top-0 z-50 max-w-[calc(100vw-16px)] outline-none", className)}
            >
              <PortalContainerContext.Provider value={contentNode}>
                {typeof children === "function" ? children(() => close(true)) : children}
              </PortalContainerContext.Provider>
            </div>,
            container ?? document.body,
          )
        : null}
    </>
  );
}

export type InfoPopoverProps = {
  children: ReactNode;
  label?: string;
  align?: PopoverAlign;
  side?: PopoverSide;
  className?: string;
};

export function InfoPopover({ children, label = "About", align = "start", side = "bottom", className }: InfoPopoverProps) {
  return (
    <Popover
      trigger={<IconButton icon={Info} label={label} size="sm" className="text-fg-muted" />}
      label={label}
      align={align}
      side={side}
      className={cn("w-72 p-3 text-[13px] leading-relaxed text-fg-muted", className)}
    >
      {children}
    </Popover>
  );
}
