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

import NotebookInsightsDrawer from "../NotebookInsightsDrawer";
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

describe("NotebookInsightsDrawer", () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.delete.mockReset();
  });

  it("moves a note using recommendation and refetches suggestions", async () => {
    const onMoveNote = vi.fn().mockResolvedValue(undefined);

    mockedApi.get.mockResolvedValue({
      data: {
        recommendations: [
          {
            id: "rec1",
            name: "Ideas",
            score: 0.82,
            noteCount: 5,
          },
        ],
      },
    });

    renderWithClient(
      <NotebookInsightsDrawer
        open
        note={{ _id: "note1", title: "Draft note", tags: ["tag1"] }}
        onClose={() => {}}
        onMoveNote={onMoveNote}
        onViewNotebook={() => {}}
        onApplySmartView={() => {}}
        notebooks={[{ id: "rec1", name: "Ideas" }]}
        savedQueries={[]}
        activeNotebookId="all"
      />,
    );

    const moveButton = await screen.findByRole("button", {
      name: /move note here/i,
    });

    await userEvent.click(moveButton);

    await waitFor(() =>
      expect(onMoveNote).toHaveBeenCalledWith("note1", "rec1"),
    );

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledTimes(2));
  });
});
