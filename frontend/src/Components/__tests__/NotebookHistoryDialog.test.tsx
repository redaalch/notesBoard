import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../lib/axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import NotebookHistoryDialog from "../NotebookHistoryDialog";
import api from "../../lib/axios";

const mockedApi = api as unknown as {
  get: Mock;
  post: Mock;
  delete: Mock;
};

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
  return { ...result, queryClient };
};

describe("NotebookHistoryDialog", () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.delete.mockReset();
  });

  it("calls onUndoSuccess with notebook context", async () => {
    const onUndoSuccess = vi.fn();
    const createdAt = new Date().toISOString();

    mockedApi.get.mockResolvedValueOnce({
      data: {
        events: [
          {
            id: "event1",
            eventType: "notebook.update",
            summary: "Updated notebook details",
            createdAt,
          },
        ],
        hasMore: false,
      },
    });

    mockedApi.post.mockResolvedValueOnce({
      data: {
        action: "restoreNotebookFields",
      },
    });

    renderWithClient(
      <NotebookHistoryDialog
        notebook={{ id: "nb1", name: "Product Notebook" }}
        notebooks={[]}
        open
        onClose={() => {}}
        onUndoSuccess={onUndoSuccess}
      />,
    );

    await screen.findByText("Updated notebook details");

    await userEvent.click(await screen.findByRole("button", { name: /undo/i }));

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith(
        "/notebooks/nb1/history/undo",
        {
          eventId: "event1",
        },
      ),
    );

    await waitFor(() =>
      expect(onUndoSuccess).toHaveBeenCalledWith({
        notebookId: "nb1",
        result: {
          action: "restoreNotebookFields",
        },
      }),
    );
  });
});
