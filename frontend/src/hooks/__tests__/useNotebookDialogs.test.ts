import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";

import useNotebookDialogs from "../useNotebookDialogs";

const notebookA = { id: "nb_a", name: "Alpha" };
const notebookB = { id: "nb_b", name: "Bravo" };

describe("useNotebookDialogs", () => {
  it("starts with every dialog closed", () => {
    const { result } = renderHook(() => useNotebookDialogs());
    expect(result.current.publish.value).toBe(null);
    expect(result.current.history.value).toBe(null);
    expect(result.current.analytics.value).toBe(null);
    expect(result.current.share.value).toBe(null);
  });

  it("open() stores the notebook and close() clears it", () => {
    const { result } = renderHook(() => useNotebookDialogs());

    act(() => result.current.publish.open(notebookA));
    expect(result.current.publish.value).toEqual(notebookA);

    act(() => result.current.publish.close());
    expect(result.current.publish.value).toBe(null);
  });

  it("ignores open() when called with null or undefined", () => {
    const { result } = renderHook(() => useNotebookDialogs());

    act(() => result.current.history.open(null));
    expect(result.current.history.value).toBe(null);

    act(() => result.current.history.open(undefined));
    expect(result.current.history.value).toBe(null);
  });

  it("keeps dialogs independent of one another", () => {
    const { result } = renderHook(() => useNotebookDialogs());

    act(() => {
      result.current.share.open(notebookA);
      result.current.analytics.open(notebookB);
    });

    expect(result.current.share.value).toEqual(notebookA);
    expect(result.current.analytics.value).toEqual(notebookB);
    expect(result.current.publish.value).toBe(null);
    expect(result.current.history.value).toBe(null);

    act(() => result.current.share.close());
    expect(result.current.share.value).toBe(null);
    expect(result.current.analytics.value).toEqual(notebookB);
  });

  it("replaces the stored notebook when open() is called again", () => {
    const { result } = renderHook(() => useNotebookDialogs());

    act(() => result.current.publish.open(notebookA));
    act(() => result.current.publish.open(notebookB));

    expect(result.current.publish.value).toEqual(notebookB);
  });

  it("returns stable open/close callback identities across renders", () => {
    const { result, rerender } = renderHook(() => useNotebookDialogs());
    const firstOpen = result.current.history.open;
    const firstClose = result.current.history.close;

    rerender();

    expect(result.current.history.open).toBe(firstOpen);
    expect(result.current.history.close).toBe(firstClose);
  });
});
