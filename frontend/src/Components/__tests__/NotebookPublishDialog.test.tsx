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

import NotebookPublishDialog from "../NotebookPublishDialog";
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

describe("NotebookPublishDialog", () => {
  beforeEach(() => {
    mockedApi.get.mockReset();
    mockedApi.post.mockReset();
    mockedApi.delete.mockReset();
  });

  it("publishes the notebook and notifies the parent with normalized slug", async () => {
    const onUpdated = vi.fn();

    mockedApi.get.mockResolvedValueOnce({
      data: {
        isPublic: false,
        slug: null,
        metadata: {},
      },
    });
    mockedApi.get.mockResolvedValue({
      data: {
        isPublic: true,
        slug: "launch-plannew-slug-123",
        metadata: {},
      },
    });

    mockedApi.post.mockResolvedValueOnce({
      data: {
        isPublic: true,
        slug: "launch-plannew-slug-123",
      },
    });

    renderWithClient(
      <NotebookPublishDialog
        notebook={{ id: "nb1", name: "Launch Plan" }}
        open
        onClose={() => {}}
        onUpdated={onUpdated}
      />,
    );

    const slugInput = await screen.findByPlaceholderText(
      "e.g. notebook-launch-plan",
    );
    await userEvent.clear(slugInput);
    await userEvent.type(slugInput, "New Slug 123");

    const publishButton = await screen.findByRole("button", {
      name: /publish notebook/i,
    });
    await userEvent.click(publishButton);

    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith("/notebooks/nb1/publish", {
        slug: "launch-plannew-slug-123",
        metadata: null,
      }),
    );

    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith({
        notebookId: "nb1",
        action: "publish",
        state: {
          isPublic: true,
          slug: "launch-plannew-slug-123",
        },
      }),
    );
  });
});
