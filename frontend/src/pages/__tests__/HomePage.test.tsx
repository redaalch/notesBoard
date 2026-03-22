import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

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

vi.mock("../../Components/Navbar", () => ({
  default: ({ searchQuery, onSearchChange, onMobileSidebarClick }: any) => (
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

vi.mock("../../Components/Sidebar", () => ({
  default: ({ onSelectNotebook }: any) => (
    <div>
      <button type="button" onClick={() => onSelectNotebook("all")}>
        notebook-all
      </button>
    </div>
  ),
}));

vi.mock("../../Components/Toolbar", () => ({
  default: ({ onToggleSelection }: any) => (
    <div>
      <button type="button" onClick={onToggleSelection}>
        toggle-selection
      </button>
    </div>
  ),
}));

vi.mock("../../Components/NoteCard", () => ({
  default: ({ note, selectionMode, selected, onSelectionChange }: any) => (
    <article>
      <h3>{note.title}</h3>
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
  default: ({ onAddTags }: any) => (
    <div>
      <button type="button" onClick={onAddTags}>
        add-tags
      </button>
    </div>
  ),
}));

vi.mock("../../Components/TagInput", () => ({
  default: ({ value, onChange }: any) => (
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

const mockedApi = api as unknown as {
  get: Mock;
  post: Mock;
  put: Mock;
  patch: Mock;
  delete: Mock;
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

const buildApiGetMock = (notes: any[]) => {
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
      return { data: { notebooks: [], uncategorizedCount: notes.length } };
    }
    if (url === "/templates") {
      return { data: [] };
    }
    if (url === "/boards") {
      return {
        data: {
          boards: [{ id: "board-1", name: "Main Board", workspaceName: "WS" }],
          defaultBoardId: "board-1",
        },
      };
    }
    if (url === "/workspaces") {
      return { data: [] };
    }
    return { data: {} };
  });
};

const renderHomePage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <HomePage />
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

    renderHomePage();

    await screen.findByText("Note 1");
    expect(screen.queryByText("Note 7")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect(await screen.findByText("Note 7")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("search notes"));
    await userEvent.type(screen.getByLabelText("search notes"), "Note 7");

    await waitFor(() => {
      expect(screen.getByText("Note 7")).toBeInTheDocument();
      expect(screen.queryByText("Note 1")).not.toBeInTheDocument();
    });
  });

  it("opens the add-tags modal from bulk actions", async () => {
    const notes = createNotes(2);
    buildApiGetMock(notes);

    renderHomePage();

    await screen.findByText("Note 1");

    await userEvent.click(
      screen.getByRole("button", { name: "toggle-selection" }),
    );

    await userEvent.click(screen.getByLabelText("select-Note 1"));

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

    await screen.findByText("Note 1");

    await userEvent.click(
      screen.getByRole("button", { name: "toggle-selection" }),
    );

    const firstCheckbox = screen.getByLabelText(
      "select-Note 1",
    ) as HTMLInputElement;
    await userEvent.click(firstCheckbox);
    expect(firstCheckbox.checked).toBe(true);

    // Turn selection mode off then back on.
    await userEvent.click(
      screen.getByRole("button", { name: "toggle-selection" }),
    );
    expect(screen.queryByLabelText("select-Note 1")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "toggle-selection" }),
    );

    const reopenedCheckbox = (await screen.findByLabelText(
      "select-Note 1",
    )) as HTMLInputElement;
    expect(reopenedCheckbox.checked).toBe(false);
  });
});
