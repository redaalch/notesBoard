import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../lib/axios.js", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import NotebookPublishDialog from "../NotebookPublishDialog";
import api from "../../lib/axios";

const renderWithClient = (ui) => {
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
    api.get.mockReset();
    api.post.mockReset();
    api.delete.mockReset();
  });

  it("publishes the notebook and notifies the parent with normalized slug", async () => {
    const onUpdated = vi.fn();

    api.get.mockResolvedValueOnce({
      data: {
        isPublic: false,
        slug: null,
        metadata: {},
      },
    });
    api.get.mockResolvedValue({
      data: {
        isPublic: true,
        slug: "launch-plannew-slug-123",
        metadata: {},
      },
    });

    api.post.mockResolvedValueOnce({
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
      expect(api.post).toHaveBeenCalledWith("/notebooks/nb1/publish", {
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
