import { describe, it, expect } from "vitest";

import {
  getNoteId,
  getNotebookDroppableId,
  mergeOrder,
  normalizeSortDirection,
  savedSortToSortOrder,
  sortOrderToSavedSort,
} from "../homePageUtils";

describe("getNoteId", () => {
  it("prefers _id over id", () => {
    expect(getNoteId({ _id: "mongo", id: "alt" })).toBe("mongo");
  });

  it("falls back to id when _id is missing", () => {
    expect(getNoteId({ id: "alt" })).toBe("alt");
  });

  it("returns null for null or undefined", () => {
    expect(getNoteId(null)).toBe(null);
    expect(getNoteId(undefined)).toBe(null);
  });

  it("returns null when the note carries neither id", () => {
    expect(getNoteId({})).toBe(null);
  });
});

describe("getNotebookDroppableId", () => {
  it("namespaces real ids", () => {
    expect(getNotebookDroppableId("abc123")).toBe("notebook:abc123");
  });

  it("falls back to uncategorized for null/undefined", () => {
    expect(getNotebookDroppableId(null)).toBe("notebook:uncategorized");
    expect(getNotebookDroppableId(undefined)).toBe("notebook:uncategorized");
  });
});

describe("mergeOrder", () => {
  it("keeps primary order for ids that exist in fallback", () => {
    expect(mergeOrder(["b", "a"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
  });

  it("drops primary entries not present in fallback", () => {
    expect(mergeOrder(["x", "a"], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("appends fallback-only entries at the end in fallback order", () => {
    expect(mergeOrder(["b"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
  });

  it("deduplicates repeated ids across both lists", () => {
    expect(mergeOrder(["a", "a", "b"], ["a", "b", "b"])).toEqual(["a", "b"]);
  });

  it("coerces ObjectId-like entries using toString", () => {
    const objectId = { toString: () => "abc" };
    expect(mergeOrder([objectId], ["abc", "def"])).toEqual(["abc", "def"]);
  });

  it("returns an empty array when both inputs are empty", () => {
    expect(mergeOrder([], [])).toEqual([]);
  });
});

describe("normalizeSortDirection", () => {
  it("returns asc for positive numbers and 1/true synonyms", () => {
    expect(normalizeSortDirection(1)).toBe("asc");
    expect(normalizeSortDirection(0)).toBe("asc");
    expect(normalizeSortDirection("asc")).toBe("asc");
    expect(normalizeSortDirection("ASCENDING")).toBe("asc");
    expect(normalizeSortDirection("true")).toBe("asc");
  });

  it("returns desc for negative numbers and -1/false synonyms", () => {
    expect(normalizeSortDirection(-1)).toBe("desc");
    expect(normalizeSortDirection("desc")).toBe("desc");
    expect(normalizeSortDirection("descending")).toBe("desc");
    expect(normalizeSortDirection("-1")).toBe("desc");
    expect(normalizeSortDirection("false")).toBe("desc");
  });

  it("returns null for unknown strings and unexpected types", () => {
    expect(normalizeSortDirection("rubbish")).toBe(null);
    expect(normalizeSortDirection(undefined)).toBe(null);
    expect(normalizeSortDirection({})).toBe(null);
  });
});

describe("sortOrderToSavedSort", () => {
  it("maps each sort order to the expected saved-sort payload", () => {
    expect(sortOrderToSavedSort("newest")).toEqual({ updatedAt: "desc" });
    expect(sortOrderToSavedSort("updated")).toEqual({ updatedAt: "desc" });
    expect(sortOrderToSavedSort("oldest")).toEqual({ updatedAt: "asc" });
    expect(sortOrderToSavedSort("alphabetical")).toEqual({ title: "asc" });
  });

  it("returns null for custom or unrecognized orders", () => {
    expect(sortOrderToSavedSort("custom")).toBe(null);
    expect(sortOrderToSavedSort("garbage")).toBe(null);
  });
});

describe("savedSortToSortOrder", () => {
  it("returns alphabetical whenever title sort is present", () => {
    expect(savedSortToSortOrder({ title: "asc" })).toBe("alphabetical");
    expect(savedSortToSortOrder({ title: "desc" })).toBe("alphabetical");
  });

  it("maps updatedAt direction to newest/oldest", () => {
    expect(savedSortToSortOrder({ updatedAt: "desc" })).toBe("newest");
    expect(savedSortToSortOrder({ updatedAt: "asc" })).toBe("oldest");
  });

  it("defaults to newest on null/undefined/unknown keys", () => {
    expect(savedSortToSortOrder(null)).toBe("newest");
    expect(savedSortToSortOrder(undefined)).toBe("newest");
    expect(savedSortToSortOrder({})).toBe("newest");
    expect(savedSortToSortOrder({ foo: "asc" })).toBe("newest");
  });

  it("round-trips with sortOrderToSavedSort for supported orders", () => {
    const orders = ["newest", "oldest", "alphabetical"] as const;
    for (const order of orders) {
      const saved = sortOrderToSavedSort(order);
      expect(savedSortToSortOrder(saved)).toBe(order);
    }
  });
});
