"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./Button";
import { isEditableTarget } from "./helpers";
import { PortalContainerContext } from "./portal";

const TEXT_FIELD =
  'input:not([type="hidden"]):not([disabled]):not([type="checkbox"]):not([type="radio"]), textarea:not([disabled]), select:not([disabled])';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLocks = 0;
let previousOverflow = "";

function lockScroll() {
  if (scrollLocks === 0) {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.documentElement.style.overflow = previousOverflow;
}

function showDialog(dialog: HTMLDialogElement) {
  if (dialog.hasAttribute("open")) return;
  if (typeof dialog.showModal === "function") {
    try {
      dialog.showModal();
      return;
    } catch {
      dialog.setAttribute("open", "");
      return;
    }
  }
  dialog.setAttribute("open", "");
}

function hideDialog(dialog: HTMLDialogElement) {
  if (typeof dialog.close === "function" && dialog.hasAttribute("open")) {
    try {
      dialog.close();
    } catch {
      dialog.removeAttribute("open");
    }
  }
  dialog.removeAttribute("open");
}

function queryVisible(dialog: HTMLDialogElement, selector: string): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter((element) => !element.closest("[hidden]"));
}

function focusInitial(dialog: HTMLDialogElement) {
  const target =
    queryVisible(dialog, "[data-autofocus], [autofocus]")[0] ??
    queryVisible(dialog, TEXT_FIELD).find((element) => isEditableTarget(element)) ??
    queryVisible(dialog, FOCUSABLE).find((element) => !element.closest("[data-dialog-close]")) ??
    dialog.querySelector<HTMLElement>("[data-dialog-panel]");
  target?.focus({ preventScroll: true });
}

function useModalDialog(open: boolean, onClose: () => void) {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const requestClose = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!dialog || !open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let pointerDownOnBackdrop = false;

    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      pointerDownOnBackdrop = event.target === dialog;
    };
    const onClick = (event: globalThis.MouseEvent) => {
      if (pointerDownOnBackdrop && event.target === dialog) requestClose();
      pointerDownOnBackdrop = false;
    };
    const onNativeClose = () => requestClose();

    showDialog(dialog);
    lockScroll();
    focusInitial(dialog);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("pointerdown", onPointerDown);
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("close", onNativeClose);

    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("pointerdown", onPointerDown);
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("close", onNativeClose);
      hideDialog(dialog);
      unlockScroll();
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [dialog, open]);

  // Escape runs through React so a focused child (SearchInput, a Radix menu) can claim it first with preventDefault.
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDialogElement>) => {
      if (!open || event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    },
    [open, onClose],
  );

  return { dialog, setDialog, onKeyDown };
}

type FrameProps = {
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  className: string;
  children: ReactNode;
};

function Frame({ onSubmit, className, children }: FrameProps) {
  if (onSubmit) {
    return (
      <form
        data-dialog-panel
        tabIndex={-1}
        className={className}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(event);
        }}
      >
        {children}
      </form>
    );
  }
  return (
    <div data-dialog-panel tabIndex={-1} className={className}>
      {children}
    </div>
  );
}

type CloseButtonProps = { onClose: () => void; className?: string };

function CloseButton({ onClose, className }: CloseButtonProps) {
  return (
    <span data-dialog-close className={cn("shrink-0", className)}>
      <IconButton icon={X} label="Close" size="sm" tooltipSide="bottom" onClick={onClose} />
    </span>
  );
}

export type DialogSize = "sm" | "md" | "lg";

const DIALOG_WIDTH: Record<DialogSize, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[520px]",
  lg: "max-w-[720px]",
};

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  hideClose?: boolean;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose = false,
  onSubmit,
  className,
}: DialogProps) {
  const { dialog, setDialog, onKeyDown } = useModalDialog(open, onClose);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={setDialog}
      onKeyDown={onKeyDown}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        "m-auto max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-line bg-elevated p-0 text-fg shadow-lg backdrop:bg-scrim",
        "transition-[opacity,translate] duration-150 ease-out starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none",
        DIALOG_WIDTH[size],
        className,
      )}
    >
      {open ? (
        <PortalContainerContext.Provider value={dialog}>
          <Frame onSubmit={onSubmit} className="flex max-h-[calc(100dvh-32px)] flex-col outline-none">
            <div className="flex items-start gap-3 px-5 pb-3 pt-4">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-base font-semibold tracking-tight text-fg">
                  {title}
                </h2>
                {description ? (
                  <div id={descriptionId} className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                    {description}
                  </div>
                ) : null}
              </div>
              {hideClose ? null : <CloseButton onClose={onClose} className="-mr-1.5 -mt-0.5" />}
            </div>
            {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div> : null}
            {footer ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
            ) : null}
          </Frame>
        </PortalContainerContext.Provider>
      ) : null}
    </dialog>
  );
}

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  side?: "right" | "bottom";
  size?: "md" | "lg";
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  className?: string;
};

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "right",
  size = "md",
  onSubmit,
  className,
}: SheetProps) {
  const { dialog, setDialog, onKeyDown } = useModalDialog(open, onClose);
  const titleId = useId();
  const descriptionId = useId();
  const right = side === "right";

  return (
    <dialog
      ref={setDialog}
      onKeyDown={onKeyDown}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      data-side={side}
      className={cn(
        "m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-xl border border-b-0 border-line bg-elevated p-0 text-fg shadow-lg backdrop:bg-scrim",
        "transition-[opacity,translate] duration-200 ease-out starting:translate-y-4 starting:opacity-0 motion-reduce:transition-none",
        right
          ? cn(
              "sm:m-2 sm:ml-auto sm:h-[calc(100dvh-16px)] sm:max-h-[calc(100dvh-16px)] sm:rounded-xl sm:border-b sm:starting:translate-x-4 sm:starting:translate-y-0",
              size === "lg" ? "sm:max-w-[560px]" : "sm:max-w-[440px]",
            )
          : cn("sm:mx-auto", size === "lg" ? "sm:max-w-[800px]" : "sm:max-w-[640px]"),
        className,
      )}
    >
      {open ? (
        <PortalContainerContext.Provider value={dialog}>
          <Frame
            onSubmit={onSubmit}
            className={cn("flex max-h-[90dvh] flex-col outline-none", right && "sm:h-full sm:max-h-none")}
          >
            <div aria-hidden className={cn("mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong", right && "sm:hidden")} />
            <div className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate text-[15px] font-semibold tracking-tight text-fg">
                  {title}
                </h2>
                {description ? (
                  <div id={descriptionId} className="mt-0.5 text-[13px] text-fg-muted">
                    {description}
                  </div>
                ) : null}
              </div>
              <CloseButton onClose={onClose} className="-mr-1.5" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            ) : null}
          </Frame>
        </PortalContainerContext.Provider>
      ) : null}
    </dialog>
  );
}
