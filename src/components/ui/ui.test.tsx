import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { useState } from "react";
import { Bell, Inbox, LayoutGrid, List, Pencil, Plus, Trash2 } from "lucide-react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cn } from "@/lib/utils";
import {
  Button,
  Checkbox,
  ConfirmProvider,
  Dialog,
  EmptyState,
  Field,
  FileButton,
  IconButton,
  InfoPopover,
  Menu,
  PageHeader,
  Popover,
  SearchInput,
  Segmented,
  Select,
  Sheet,
  SubNav,
  Switch,
  Tabs,
  TextInput,
  formatHotkey,
  isEditableTarget,
  matchesHotkey,
  tabPanelProps,
  useConfirm,
  useHotkey,
  usePersistentState,
} from "./index";
import { detectMac } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users/42" }));
// The first jsdom render pays React/Radix warm-up, which can exceed 5s on a loaded runner.
vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.style.overflow = "";
});

describe("IconButton", () => {
  it("uses the required label as aria-label and tooltip", () => {
    const { rerender } = render(<IconButton icon={Bell} label="Notifications" />);
    const button = screen.getByRole("button", { name: "Notifications" });
    expect(button).toHaveAttribute("aria-label", "Notifications");
    expect(button).toHaveAttribute("data-tooltip", "Notifications");
    expect(button).toHaveAttribute("type", "button");

    rerender(<IconButton icon={Bell} label="Notifications" badge={3} />);
    expect(screen.getByRole("button", { name: "Notifications (3)" })).toHaveAttribute("data-tooltip", "Notifications");
  });

  it("renders a link when href is set", () => {
    render(<IconButton icon={Plus} label="New" href="/studio" />);
    expect(screen.getByRole("link", { name: "New" })).toHaveAttribute("href", "/studio");
  });

  it("accepts native button attributes such as form, name and value", () => {
    render(<IconButton icon={Plus} label="Add" type="submit" form="f" name="intent" value="add" />);
    const button = screen.getByRole("button", { name: "Add" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("form", "f");
    expect(button).toHaveAttribute("name", "intent");
    expect(button).toHaveAttribute("value", "add");
  });
});

describe("Segmented", () => {
  type View = "grid" | "list" | "board";

  function SegmentedHarness({ onChange }: { onChange: (value: View) => void }) {
    const [value, setValue] = useState<View>("grid");
    return (
      <Segmented<View>
        ariaLabel="View"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        options={[
          { value: "grid", label: "Grid", icon: LayoutGrid },
          { value: "list", label: "List", icon: List },
          { value: "board", label: "Board" },
        ]}
      />
    );
  }

  it("uses radiogroup semantics with roving tabindex and arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedHarness onChange={onChange} />);

    expect(screen.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
    const grid = screen.getByRole("radio", { name: "Grid" });
    const list = screen.getByRole("radio", { name: "List" });
    const board = screen.getByRole("radio", { name: "Board" });
    expect(grid).toHaveAttribute("aria-checked", "true");
    expect(grid).toHaveAttribute("tabindex", "0");
    expect(list).toHaveAttribute("tabindex", "-1");

    grid.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("list");
    expect(list).toHaveAttribute("aria-checked", "true");
    expect(list).toHaveFocus();

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("board");
    expect(board).toHaveFocus();

    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("grid");

    await user.click(board);
    expect(onChange).toHaveBeenLastCalledWith("board");
    expect(board).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("radiogroup")).not.toHaveClass("overflow-visible");
  });

  it("lets tooltips of icon-only options overflow the group", () => {
    render(
      <Segmented
        ariaLabel="Layout"
        value="grid"
        onChange={vi.fn()}
        options={[
          { value: "grid", label: "Grid", icon: LayoutGrid, hideLabel: true },
          { value: "list", label: "List", icon: List, hideLabel: true },
        ]}
      />,
    );
    expect(screen.getByRole("radiogroup", { name: "Layout" })).toHaveClass("overflow-visible");
    expect(screen.getByRole("radio", { name: "Grid" })).toHaveAttribute("data-tooltip", "Grid");
  });
});

describe("Tabs", () => {
  it("renders tablist semantics linked to panels", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs
        ariaLabel="Sections"
        idPrefix="course"
        value="overview"
        onChange={onChange}
        items={[
          { value: "overview", label: "Overview" },
          { value: "members", label: "Members", count: 4 },
        ]}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Sections" })).toBeInTheDocument();
    const [overview, members] = screen.getAllByRole("tab");
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(overview).toHaveAttribute("aria-controls", tabPanelProps("course", "overview").id);
    expect(overview.id).toBe(tabPanelProps("course", "overview")["aria-labelledby"]);
    expect(members).toHaveAttribute("aria-selected", "false");
    expect(members).toHaveAttribute("tabindex", "-1");

    await user.click(members);
    expect(onChange).toHaveBeenCalledWith("members");
  });
});

describe("Menu", () => {
  it("renders items when opened and closes after selecting", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <Menu
        items={[
          { label: "Edit", icon: Pencil, onSelect: onEdit },
          { separator: true },
          { label: "Delete", icon: Trash2, danger: true, onSelect: vi.fn() },
          false,
        ]}
      />,
    );

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "More" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Edit", "Delete"]);
    expect(screen.getByRole("separator")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("returns focus to the trigger after a confirm opened from an item closes", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    function MenuConfirmHarness() {
      const confirm = useConfirm();
      return (
        <Menu
          items={[
            {
              label: "Delete",
              danger: true,
              onSelect: async () => onResult(await confirm({ title: "Delete class?", danger: true })),
            },
          ]}
        />
      );
    }
    render(
      <ConfirmProvider>
        <MenuConfirmHarness />
      </ConfirmProvider>,
    );
    const trigger = screen.getByRole("button", { name: "More" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.click(cancel);
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("wraps a plain text trigger in a button", () => {
    render(<Menu trigger="Sort" items={[{ label: "Newest" }]} />);
    expect(screen.getByRole("button", { name: "Sort" })).toHaveAttribute("aria-haspopup", "menu");
  });
});

describe("Dialog", () => {
  function DialogHarness({ onClose }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <Dialog
          open={open}
          onClose={() => {
            onClose?.();
            setOpen(false);
          }}
          title="Rename"
          footer={<Button onClick={() => setOpen(false)}>Done</Button>}
        >
          <Field label="Name">
            <TextInput />
          </Field>
        </Dialog>
      </>
    );
  }

  it("opens without native showModal, focuses the first field, closes on Escape and returns focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open" });

    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Rename" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute("open");
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("uses native showModal when available and closes on cancel and backdrop click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    const close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { value: showModal, configurable: true });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { value: close, configurable: true });

    try {
      render(<DialogHarness onClose={onClose} />);
      await user.click(screen.getByRole("button", { name: "Open" }));
      expect(showModal).toHaveBeenCalledTimes(1);
      const dialog = screen.getByRole("dialog", { name: "Rename" });

      fireEvent(dialog, new Event("cancel", { cancelable: true }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Open" }));
      fireEvent.pointerDown(dialog);
      fireEvent.click(dialog);
      expect(onClose).toHaveBeenCalledTimes(2);
    } finally {
      for (const [name, descriptor] of [
        ["showModal", originalShowModal],
        ["close", originalClose],
      ] as const) {
        if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
        else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
      }
    }
  });

  it("lets a focused child claim Escape before the dialog closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    function SearchDialog() {
      const [query, setQuery] = useState("abc");
      return (
        <Dialog open onClose={onClose} title="Pick">
          <SearchInput value={query} onChange={setQuery} label="Find" />
        </Dialog>
      );
    }
    render(<SearchDialog />);
    const search = screen.getByRole("searchbox", { name: "Find" });
    expect(search).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(search).toHaveValue("");
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps a Sheet open when a child prevents Escape, and a nested menu takes Escape first", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Edit">
        <TextInput aria-label="Inline" onKeyDown={(event) => event.key === "Escape" && event.preventDefault()} />
        <Menu label="Sort" items={[{ label: "Newest" }]} />
      </Sheet>,
    );
    expect(screen.getByLabelText("Inline")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    screen.getByRole("button", { name: "Sort" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();
  });

  it("focuses the first real field, skipping FileButton's hidden input", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Import">
        <FileButton onFiles={vi.fn()}>Upload</FileButton>
        <Field label="Name">
          <TextInput />
        </Field>
      </Dialog>,
    );
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
  });

  it("honours autoFocus on a later field", () => {
    render(
      <Dialog open onClose={vi.fn()} title="Rename">
        <Field label="First">
          <TextInput />
        </Field>
        <Field label="Second">
          <TextInput autoFocus />
        </Field>
      </Dialog>,
    );
    expect(screen.getByRole("textbox", { name: "Second" })).toHaveFocus();
  });

  it("marks autoFocus controls for dialog initial focus", () => {
    render(
      <>
        <SearchInput value="" onChange={vi.fn()} label="Find" autoFocus />
        <Select aria-label="Role" autoFocus options={[{ value: "a", label: "A" }]} />
        <TextInput aria-label="Plain" />
      </>,
    );
    expect(screen.getByRole("searchbox", { name: "Find" })).toHaveAttribute("data-autofocus");
    expect(screen.getByRole("combobox", { name: "Role" })).toHaveAttribute("data-autofocus");
    expect(screen.getByRole("textbox", { name: "Plain" })).not.toHaveAttribute("data-autofocus");
  });

  it("Sheet renders a labelled drawer with its footer and focuses the first field", () => {
    render(
      <Sheet open onClose={vi.fn()} title="New course" footer={<Button variant="primary">Save</Button>}>
        <TextInput aria-label="Course title" />
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "New course" })).toHaveAttribute("data-side", "right");
    expect(screen.getByLabelText("Course title")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});

describe("useConfirm", () => {
  function ConfirmHarness({ onResult }: { onResult: (value: boolean) => void }) {
    const confirm = useConfirm();
    return (
      <button
        type="button"
        onClick={async () =>
          onResult(
            await confirm({ title: "Delete class?", body: "This cannot be undone.", confirmLabel: "Delete", danger: true }),
          )
        }
      >
        Remove
      </button>
    );
  }

  it("resolves true on confirm and false on cancel or Escape", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <ConfirmProvider>
        <ConfirmHarness onResult={onResult} />
      </ConfirmProvider>,
    );
    const remove = screen.getByRole("button", { name: "Remove" });

    await user.click(remove);
    const dialog = screen.getByRole("dialog", { name: "Delete class?" });
    expect(dialog).toHaveAccessibleDescription("This cannot be undone.");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(true));

    await user.click(remove);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(false));

    await user.click(remove);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(3));
    expect(onResult).toHaveBeenLastCalledWith(false);
  });
});

describe("usePersistentState", () => {
  const QUOTED = JSON.stringify("quoted");

  function Counter({ testId }: { testId: string }) {
    const [count, setCount] = usePersistentState("test-count", 0);
    return (
      <button type="button" data-testid={testId} onClick={() => setCount((previous) => previous + 1)}>
        {count}
      </button>
    );
  }

  it("reads, writes and syncs instances and tabs", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("test-count", "5");
    render(
      <>
        <Counter testId="a" />
        <Counter testId="b" />
      </>,
    );
    expect(screen.getByTestId("a")).toHaveTextContent("5");

    await user.click(screen.getByTestId("a"));
    expect(screen.getByTestId("a")).toHaveTextContent("6");
    expect(screen.getByTestId("b")).toHaveTextContent("6");
    expect(window.localStorage.getItem("test-count")).toBe("6");

    act(() => {
      window.localStorage.setItem("test-count", "10");
      window.dispatchEvent(new StorageEvent("storage", { key: "test-count", newValue: "10" }));
    });
    expect(screen.getByTestId("b")).toHaveTextContent("10");

    act(() => {
      window.localStorage.setItem("test-count", '"oops"');
      window.dispatchEvent(new StorageEvent("storage", { key: "test-count", newValue: '"oops"' }));
    });
    expect(screen.getByTestId("a")).toHaveTextContent("0");
  });

  it("renders the initial value from the server snapshot", () => {
    window.localStorage.setItem("test-count", "7");
    expect(renderToString(<Counter testId="server" />)).toContain(">0</button>");
  });

  it("tolerates raw string values", () => {
    window.localStorage.setItem("test-mode", "expanded");
    function Mode() {
      const [mode] = usePersistentState("test-mode", "rail");
      return <span>{mode}</span>;
    }
    render(<Mode />);
    expect(screen.getByText("expanded")).toBeInTheDocument();
  });

  it("stores string values raw so pre-paint scripts can read them", async () => {
    const user = userEvent.setup();
    function Mode({ next }: { next: string }) {
      const [mode, setMode] = usePersistentState("test-mode", "rail");
      return (
        <button type="button" onClick={() => setMode(next)}>
          {mode}
        </button>
      );
    }
    const { rerender } = render(<Mode next="expanded" />);
    await user.click(screen.getByRole("button", { name: "rail" }));
    expect(window.localStorage.getItem("test-mode")).toBe("expanded");
    expect(screen.getByRole("button", { name: "expanded" })).toBeInTheDocument();

    rerender(<Mode next={QUOTED} />);
    await user.click(screen.getByRole("button", { name: "expanded" }));
    expect(screen.getByRole("button", { name: QUOTED })).toBeInTheDocument();
  });

  it("reads numeric-looking and legacy JSON-quoted strings for string keys", () => {
    window.localStorage.setItem("test-code", "123");
    window.localStorage.setItem("test-legacy", JSON.stringify("expanded"));
    function Values() {
      const [code] = usePersistentState("test-code", "x");
      const [legacy] = usePersistentState("test-legacy", "rail");
      return (
        <>
          <span data-testid="code">{code}</span>
          <span data-testid="legacy">{legacy}</span>
        </>
      );
    }
    render(<Values />);
    expect(screen.getByTestId("code")).toHaveTextContent("123");
    expect(screen.getByTestId("legacy")).toHaveTextContent(/^expanded$/);
  });
});

describe("PageHeader", () => {
  it("renders a single h1 with back link, count, actions and sub navigation", () => {
    render(
      <PageHeader title="People" count={12} back="/admin/dashboard" actions={<Button variant="primary">New</Button>}>
        <SubNav
          items={[
            { href: "/admin/users", label: "Users" },
            { href: "/admin/permissions", label: "Roles" },
          ]}
        />
      </PageHeader>,
    );

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("People");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/admin/dashboard");
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Roles" })).not.toHaveAttribute("aria-current");
  });
});

describe("EmptyState", () => {
  it("renders the title, hint and action", () => {
    render(<EmptyState icon={Inbox} title="No courses" hint="Create one to start" action={<Button>New course</Button>} />);
    expect(screen.getByText("No courses")).toBeInTheDocument();
    expect(screen.getByText("Create one to start")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New course" })).toBeInTheDocument();
  });
});

describe("form primitives", () => {
  it("Field links its label, hint and error to the control", () => {
    render(
      <Field label="Email" hint="Work address" error="Required" required>
        <TextInput type="email" />
      </Field>,
    );
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAccessibleDescription("Work address Required");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toBeRequired();
  });

  it("Field supports render-prop children", () => {
    render(<Field label="Title">{(id) => <input id={id} />}</Field>);
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("Field describes and flags Switch, Checkbox and SearchInput controls", () => {
    render(
      <>
        <Field label="Notify" hint="Email me" error="Required">
          <Switch checked={false} onChange={vi.fn()} label="Notify" description="Weekly" />
        </Field>
        <Field label="Terms" hint="Read first">
          <Checkbox label="Accept" description="Desc text" />
        </Field>
        <p id="ext">External</p>
        <Checkbox label="Solo" description="Solo desc" aria-describedby="ext" />
        <Field label="Student">
          <SearchInput value="" onChange={vi.fn()} />
        </Field>
      </>,
    );
    const toggle = screen.getByRole("switch", { name: "Notify" });
    expect(toggle).toHaveAccessibleDescription("Weekly Email me Required");
    expect(toggle).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("checkbox", { name: "Terms Accept" })).toHaveAccessibleDescription("Desc text Read first");
    expect(screen.getByRole("checkbox", { name: "Solo" })).toHaveAccessibleDescription("Solo desc External");
    expect(screen.getByRole("searchbox", { name: "Student" })).not.toHaveAttribute("aria-label");
  });

  it("an uncontrolled Select with a placeholder starts empty and fails required validation", () => {
    const options = [
      { value: "student", label: "Student" },
      { value: "teacher", label: "Teacher" },
    ];
    render(
      <form data-testid="form">
        <Select name="role" required placeholder="Choose role" options={options} />
        <Select name="level" placeholder="Choose level" defaultValue="teacher" options={options} />
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    const [role, level] = screen.getAllByRole("combobox");
    expect(role).toHaveValue("");
    expect(level).toHaveValue("teacher");
    expect(new FormData(form).get("role")).toBe("");
    expect(form.checkValidity()).toBe(false);
  });

  it("Switch toggles through its label", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Compact" />);
    const toggle = screen.getByRole("switch", { name: "Compact" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByText("Compact"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("Checkbox reports checked state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Archived" onChange={onChange} />);
    await user.click(screen.getByLabelText("Archived"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("FileButton is a real button that opens the picker and resets the input", async () => {
    const user = userEvent.setup();
    const onFiles = vi.fn();
    const { container } = render(
      <FileButton accept="image/*" onFiles={onFiles}>
        Upload avatar
      </FileButton>,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const click = vi.spyOn(input as HTMLInputElement, "click");

    await user.click(screen.getByRole("button", { name: "Upload avatar" }));
    expect(click).toHaveBeenCalledTimes(1);

    const file = new File(["x"], "avatar.png", { type: "image/png" });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("icon-only FileButton forwards its button props", () => {
    render(<FileButton onFiles={vi.fn()} label="Upload file" id="up" aria-describedby="help" data-x="1" />);
    const button = screen.getByRole("button", { name: "Upload file" });
    expect(button).toHaveAttribute("id", "up");
    expect(button).toHaveAttribute("aria-describedby", "help");
    expect(button).toHaveAttribute("data-x", "1");
  });
});

describe("Popover", () => {
  it("opens on click, closes on Escape and outside click, and returns focus", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Popover trigger={<Button>Filters</Button>} label="Filter options">
          <Checkbox label="Archived" />
        </Popover>
        <button type="button">Outside</button>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Filters" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Filter options" })).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Archived")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the outer Popover open for a nested InfoPopover, and Escape closes only the inner one", async () => {
    const user = userEvent.setup();
    render(
      <Popover trigger={<Button>Filters</Button>} label="Filters">
        <span>Outer body</span>
        <InfoPopover label="Help">Inner help</InfoPopover>
      </Popover>,
    );
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByText("Inner help")).toBeInTheDocument();
    expect(screen.getByText("Outer body")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Inner help")).not.toBeInTheDocument();
    expect(screen.getByText("Outer body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help" })).toHaveFocus();
  });

  it("keeps the outer Popover open for a nested Menu and runs its items", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Popover trigger={<Button>Filters</Button>} label="Filters">
        <span>Outer body</span>
        <Menu label="Sort" items={[{ label: "Newest", onSelect }]} />
      </Popover>,
    );
    await user.click(screen.getByRole("button", { name: "Filters" }));
    screen.getByRole("button", { name: "Sort" }).focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitem", { name: "Newest" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Outer body")).toBeInTheDocument();
  });

  it("names an unlabelled Popover by its trigger", async () => {
    const user = userEvent.setup();
    render(<Popover trigger={<Button>Filters</Button>}>content</Popover>);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeInTheDocument();
  });

  it("InfoPopover shows help text behind an icon button", async () => {
    const user = userEvent.setup();
    render(<InfoPopover label="About scores">Scores update nightly.</InfoPopover>);
    expect(screen.queryByText("Scores update nightly.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "About scores" }));
    expect(screen.getByText("Scores update nightly.")).toBeInTheDocument();
  });
});

describe("cn", () => {
  it("treats token shadows as shadow sizes, not shadow colors", () => {
    expect(cn("shadow-sm", "shadow-soft")).toBe("shadow-soft");
    expect(cn("shadow-soft", "shadow-lg")).toBe("shadow-lg");
    expect(cn("shadow-soft", "shadow-accent")).toBe("shadow-soft shadow-accent");
  });
});

describe("keyboard helpers", () => {
  function HotkeyHarness({ onHit, enableInInputs }: { onHit: () => void; enableInInputs?: boolean }) {
    useHotkey("mod+k", onHit, { enableInInputs });
    return <input aria-label="Query" />;
  }

  const modKey = () => (detectMac() ? { metaKey: true } : { ctrlKey: true });

  it("useHotkey fires for mod combos and ignores editable targets by default", () => {
    const onHit = vi.fn();
    const { unmount } = render(<HotkeyHarness onHit={onHit} />);
    const notPrevented = fireEvent.keyDown(document.body, { key: "k", ...modKey() });
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);

    fireEvent.keyDown(screen.getByLabelText("Query"), { key: "k", ...modKey() });
    expect(onHit).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: "k" });
    expect(onHit).toHaveBeenCalledTimes(1);
    unmount();

    render(<HotkeyHarness onHit={onHit} enableInInputs />);
    fireEvent.keyDown(screen.getByLabelText("Query"), { key: "k", ...modKey() });
    expect(onHit).toHaveBeenCalledTimes(2);
  });

  it("isEditableTarget recognises text entry targets", () => {
    const text = document.createElement("input");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    editable.append(child);

    expect(isEditableTarget(text)).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("select"))).toBe(true);
    expect(isEditableTarget(child)).toBe(true);
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it("formats and matches hotkeys per platform", () => {
    expect(formatHotkey("mod+k", true)).toBe("⌘K");
    expect(formatHotkey("mod+k", false)).toBe("Ctrl+K");
    expect(formatHotkey("shift+escape", false)).toBe("Shift+Esc");
    const event = { key: "K", code: "KeyK", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };
    expect(matchesHotkey(event, "mod+k", true)).toBe(true);
    expect(matchesHotkey(event, "mod+k", false)).toBe(false);
    expect(matchesHotkey({ ...event, key: "?", metaKey: false, shiftKey: true }, "?", false)).toBe(true);
  });
});
