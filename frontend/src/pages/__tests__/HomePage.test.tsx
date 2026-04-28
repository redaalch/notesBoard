import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { LazyMotion, domAnimation } from "framer-motion";

vi.mock("../../lib/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../contexts/CommandPaletteContext", () => ({
  useCommandPalette: () => ({
    registerCommands: () => () => {},
  }),
}));

vi.mock("../../hooks/useSemanticSearch", () => ({
  default: () => ({
    results: [],
    searchMode: "keyword",
    isSearching: false,
    isActive: false,
  }),
}));

type NavbarMockProps = {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onMobileSidebarClick: () => void;
};
vi.mock("../../Components/Navbar", () => ({
  default: ({
    searchQuery,
    onSearchChange,
    onMobileSidebarClick,
  }: NavbarMockProps) => (
    <div>
      <button type="button" onClick={onMobileSidebarClick}>
        open-side
      </button>
      <input
        aria-label="search notes"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </div>
  ),
}));

type SidebarMockProps = {
  onSelectNotebook: (id: string) => void;
  onCreateNotebook?: () => void;
  onDeleteNotebook?: (nb: { id: string; name: string; noteCount: number }) => void;
};
vi.mock("../../Components/Sidebar", () => ({
  default: ({
    onSelectNotebook,
    onCreateNotebook,
    onDeleteNotebook,
  }: SidebarMockProps) => (
    <div>
      <button type="button" onClick={() => onSelectNotebook("all")}>
        notebook-all
      </button>
      <button type="button" onClick={() => onCreateNotebook?.()}>
        create-notebook
      </button>
      <button
        type="button"
        onClick={() =>
          onDeleteNotebook?.({ id: "nb-1", name: "TestNB", noteCount: 3 })
        }
      >
        delete-notebook
      </button>
    </div>
  ),
}));

type ToolbarMockProps = {
  onToggleSelection: () => void;
  filterProps?: { onSortOrderChange?: (v: string) => void };
};
vi.mock("../../Components/Toolbar", () => ({
  default: ({ onToggleSelection, filterProps }: ToolbarMockProps) => (
    <div>
      <button type="button" onClick={onToggleSelection}>
        toggle-selection
      </button>
      <select
        aria-label="sort-order"
        onChange={(e) => filterProps?.onSortOrderChange?.(e.target.value)}
      >
        <option value="newest">newest</option>
        <option value="oldest">oldest</option>
        <option value="alphabetical">alphabetical</option>
      </select>
    </div>
  ),
}));

type NoteCardMockProps = {
  note: {
    _id: string;
    title: string;
    tags?: string[];
  };
  selectionMode?: boolean;
  selected?: boolean;
  onSelectionChange?: (
    id: string,
    checked: boolean,
    ctx: { event: { shiftKey: boolean } },
  ) => void;
  onTagClick?: (tag: string) => void;
};
vi.mock("../../Components/NoteCard", () => ({
  default: ({
    note,
    selectionMode,
    selected,
    onSelectionChange,
    onTagClick,
  }: NoteCardMockProps) => (
    <article>
      <h3>{note.title}</h3>
      {(note.tags ?? []).map((tag: string) => (
        <button
          key={tag}
          type="button"
          aria-label={`tag-${tag}`}
          onClick={() => onTagClick?.(tag)}
        >
          {tag}
        </button>
      ))}
      {selectionMode ? (
        <input
          type="checkbox"
          aria-label={`select-${note.title}`}
          checked={selected}
          onChange={(event) =>
            onSelectionChange?.(note._id, event.target.checked, {
              event: { shiftKey: false },
            })
          }
        />
      ) : null}
    </article>
  ),
}));

vi.mock("../../Components/BulkActionsBar", () => ({
  default: ({ onAddTags }: { onAddTags: () => void }) => (
    <div>
      <button type="button" onClick={onAddTags}>
        add-tags
      </button>
    </div>
  ),
}));

type TagInputMockProps = {
  value?: string[];
  onChange: (v: string[]) => void;
};
vi.mock("../../Components/TagInput", () => ({
  default: ({ value, onChange }: TagInputMockProps) => (
    <input
      aria-label="tag-input"
      value={(value ?? []).join(",")}
      onChange={(event) =>
        onChange(event.target.value.split(",").filter(Boolean))
      }
    />
  ),
}));

import HomePage from "../HomePage";
import api from "../../lib/axios";
import AuthContext, {
  type AuthContextValue,
} from "../../contexts/authContext";

const mockedApi = api as unknown as {
  get: Mock;
  post: Mock;
  put: Mock;
  patch: Mock;
  delete: Mock;
};

const authContextValue: AuthContextValue = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
  },
  accessToken: "test-token",
  initializing: false,
  login: vi.fn(),
  register: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  resendVerificationEmail: vi.fn(),
  verifyEmail: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(async () => "test-token"),
};

const createNotes = (count: number) =>
  Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    return {
      _id: `note-${position}`,
      id: `note-${position}`,
      title: `Note ${position}`,
      content: `Content ${position}`,
      createdAt: new Date(Date.now() - position * 1000).toISOString(),
      updatedAt: new Date(Date.now() - position * 1000).toISOString(),
      pinned: false,
      tags: ["alpha"],
    };
  });

const createNotebook = (overrides?: {
  id?: string;
  name?: string;
  color?: string;
  noteCount?: number;
}) => ({
  id: overrides?.id ?? "nb-1",
  name: overrides?.name ?? "TestNB",
  color: overrides?.color ?? "#60a5fa",
  noteCount: overrides?.noteCount ?? 3,
});

type TestNote = ReturnType<typeof createNotes>[number];
type TestNotebook = ReturnType<typeof createNotebook>;
const buildApiGetMock = (
  notes: TestNote[],
  notebooks: TestNotebook[] = [],
) => {
  mockedApi.get.mockImplementation(async (url: string) => {
    if (url === "/notes") {
      return { data: { data: notes } };
    }
    if (url === "/notes/layout") {
      return { data: { noteIds: notes.map((note) => note._id) } };
    }
    if (url === "/notes/tags/stats") {
      return {
        data: {
          tags: [{ _id: "alpha", count: notes.length }],
          uniqueTags: 1,
          topTag: { _id: "alpha", count: notes.length },
        },
      };
    }
    if (url === "/notebooks") {
      return { data: { notebooks, uncategorizedCount: notes.length } };
    }
    if (url === "/templates") {
      return { data: [] };
    }
    if (url === "/workspaces") {
      return { data: [] };
    }
    return { data: {} };
  });
};

// Notes render in both a mobile and desktop grid (hidden via CSS media
// queries), so note text / labels appear twice in the DOM.  Use *AllBy*
// queries to avoid "found multiple elements" errors.
const waitForNotes = () => screen.findAllByText("Note 1");

const renderHomePage = (initialEntries = ["/app"]) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={authContextValue}>
          <LazyMotion features={domAnimation}>
            <HomePage />
          </LazyMotion>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe("HomePage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.put.mockReset();
    mockedApi.patch.mockReset();
    mockedApi.delete.mockReset();
  });

  it("filters by search and paginates note results", async () => {
    const notes = createNotes(8);
    buildApiGetMock(notes);

    const view = renderHomePage();

    await waitForNotes();
    expect(screen.queryAllByText("Note 7")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect((await screen.findAllByText("Note 7")).length).toBeGreaterThan(0);
    view.unmount();

    renderHomePage(["/app?q=Note%207"]);

    await waitFor(() => {
      expect(screen.getAllByText("Note 7").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("Note 1")).toHaveLength(0);
    });
  });

  it("opens the add-tags modal from bulk actions", async () => {
    const notes = createNotes(2);
    buildApiGetMock(notes);

    renderHomePage();

    await waitForNotes();

    await userEvent.click(
      screen.getByRole("button", { name: "toggle-selection" }),
    );

    const checkboxes = screen.getAllByLabelText("select-Note 1");
    await userEvent.click(checkboxes[0]);

    await userEvent.click(
      await screen.findByRole("button", { name: "add-tags" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /add tags to selected notes/i,
      }),
    ).toBeInTheDocument();
  });

  it("clears selected notes when selection mode is toggled off", async () => {
    const notes = createNotes(2);
    buildApiGetMock(notes);

    renderHomePage();

    await waitForNotes();

    await userEvent.click(
      screen.getByRole("button", { name: "toggle-selection" }),
    );

    const firstCheckbox = screen.getAllByLabelText(
      "select-Note 1",
    )[0] as HTMLInputElement;
    await userEvent.click(firstCheckbox);
    expect(firstCheckbox.checked).toBe(true);

    // Turn selection mode off then back on.
    await userEvent.click(
      screen.getByRole("button", { name: "toggle-selection" }),
    );
    expect(screen.queryAllByLabelText("select-Note 1")).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", { name: "toggle-selection" }),
    );

    const reopenedCheckboxes = await screen.findAllByLabelText(
      "select-Note 1",
    );
    expect((reopenedCheckboxes[0] as HTMLInputElement).checked).toBe(false);
  });

  it("filters notes when a tag chip is clicked", async () => {
    const notes = createNotes(8);
    buildApiGetMock(notes);

    renderHomePage();

    await waitForNotes();

    // Click the "alpha" tag on the first visible note
    const tagButtons = screen.getAllByRole("button", { name: "tag-alpha" });
    await userEvent.click(tagButtons[0]);

    // All 8 notes have "alpha", so they should all still appear (filtered to that tag)
    await waitFor(() => {
      expect(screen.getAllByText("Note 1").length).toBeGreaterThan(0);
    });
  });

  it("changing sort order resets pagination to page 1", async () => {
    const notes = createNotes(8);
    buildApiGetMock(notes);

    renderHomePage();

    // Wait for page 1 to render (6 notes per page by default)
    await waitForNotes();

    // Navigate to page 2
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect((await screen.findAllByText("Note 7")).length).toBeGreaterThan(0);

    // Change sort to alphabetical — should reset to page 1
    await userEvent.selectOptions(screen.getByLabelText("sort-order"), "alphabetical");

    await waitFor(() => {
      expect(screen.getAllByText("Note 1").length).toBeGreaterThan(0);
    });
  });

  it("opens the create-notebook modal from sidebar", async () => {
    const notes = createNotes(2);
    buildApiGetMock(notes);

    renderHomePage();

    await waitForNotes();

    await userEvent.click(
      screen.getByRole("button", { name: /new notebook/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /create a notebook/i }),
      ).toBeInTheDocument();
    });
  });

  it("opens the delete-notebook confirmation from sidebar", async () => {
    const notes = createNotes(2);
    buildApiGetMock(notes, [createNotebook()]);

    renderHomePage();

    await waitForNotes();

    await userEvent.click(
      screen.getByRole("button", { name: /actions for testnb/i }),
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /^delete$/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /delete notebook\?/i }),
      ).toBeInTheDocument();
    });
  });
});
