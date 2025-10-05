import React, { useEffect, useMemo, useState } from "react";
import {
  FilterIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import Navbar from "../Components/Navbar.jsx";
import RateLimitedUI from "../Components/RateLimitedUI.jsx";
import api from "../lib/axios.js";
import toast from "react-hot-toast";
import NoteCard from "../Components/NoteCard.jsx";
import NotesNotFound from "../Components/NotesNotFound.jsx";
import NoteSkeleton from "../Components/NoteSkeleton.jsx";
import NotesStats from "../Components/NotesStats.jsx";
import { countWords } from "../lib/Utils.js";

function HomePage() {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [minWords, setMinWords] = useState(0);
  const [sortOrder, setSortOrder] = useState("newest");

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await api.get("/notes");
        setNotes(res.data);
        setIsRateLimited(false);
      } catch (error) {
        console.log("error fetching" + error);
        if (error.response?.status === 429) {
          setIsRateLimited(true);
        } else {
          toast.error("Failed to load Notes");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, []);

  const closeDrawer = () => setDrawerOpen(false);
  const openDrawer = () => setDrawerOpen(true);

  const recentNotes = useMemo(
    () =>
      notes.filter((note) => {
        const createdAt = new Date(note.createdAt);
        return Date.now() - createdAt.getTime() <= 604_800_000; // 7 days
      }),
    [notes]
  );

  const longFormNotes = useMemo(
    () => notes.filter((note) => countWords(note.content) >= 150),
    [notes]
  );

  const shortNotes = useMemo(
    () => notes.filter((note) => countWords(note.content) <= 60),
    [notes]
  );

  const tabConfig = [
    { id: "all", label: "All notes", badge: notes.length },
    { id: "recent", label: "Recent", badge: recentNotes.length },
    { id: "long", label: "Long form", badge: longFormNotes.length },
    { id: "short", label: "Short & sweet", badge: shortNotes.length },
  ];

  const filteredNotes = useMemo(() => {
    let base = notes;
    if (activeTab === "recent") base = recentNotes;
    if (activeTab === "long") base = longFormNotes;
    if (activeTab === "short") base = shortNotes;

    const bySearch = base.filter((note) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query)
      );
    });

    const byWords = bySearch.filter(
      (note) => countWords(note.content) >= Number(minWords)
    );

    const sorted = [...byWords].sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      if (sortOrder === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (sortOrder === "alphabetical") {
        return a.title.localeCompare(b.title);
      }
      if (sortOrder === "updated") {
        return (
          new Date(b.updatedAt ?? b.createdAt) -
          new Date(a.updatedAt ?? a.createdAt)
        );
      }
      return 0;
    });

    return sorted;
  }, [
    notes,
    activeTab,
    searchQuery,
    minWords,
    sortOrder,
    recentNotes,
    longFormNotes,
    shortNotes,
  ]);

  const showFilterEmptyState =
    !loading && !isRateLimited && notes.length > 0 && !filteredNotes.length;

  return (
    <div className="drawer">
      <input
        id="notes-filters"
        type="checkbox"
        className="drawer-toggle"
        checked={drawerOpen}
        onChange={(event) => setDrawerOpen(event.target.checked)}
      />
      <div className="drawer-content flex min-h-screen flex-col">
        <Navbar onToggleFilters={openDrawer} />

        {isRateLimited && (
          <RateLimitedUI onDismiss={() => setIsRateLimited(false)} />
        )}

        <main className="flex-1 w-full">
          <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8">
            <NotesStats notes={notes} loading={loading} />

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2" role="tablist">
                {tabConfig.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    className={`tab tab-lifted ${
                      activeTab === tab.id ? "tab-active" : ""
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="flex items-center gap-2">
                      {tab.label}
                      <span className="badge badge-sm badge-outline">
                        {tab.badge}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  className="btn btn-outline gap-2 hidden lg:inline-flex"
                  onClick={openDrawer}
                >
                  <FilterIcon className="size-4" />
                  Filters
                </button>
                <div className="join">
                  <div className="join-item input input-bordered flex items-center gap-2">
                    <SearchIcon className="size-4 opacity-70" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search notes..."
                      className="grow bg-transparent outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    className="btn join-item"
                    onClick={() => {
                      setSearchQuery("");
                      setMinWords(0);
                      setSortOrder("newest");
                      setActiveTab("all");
                    }}
                  >
                    <RefreshCwIcon className="size-4" />
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {loading && <NoteSkeleton />}

            {!loading && filteredNotes.length > 0 && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredNotes.map((note) => (
                  <NoteCard key={note._id} note={note} setNotes={setNotes} />
                ))}
              </div>
            )}

            {showFilterEmptyState && (
              <div className="alert alert-info shadow-lg">
                <FilterIcon className="size-5" />
                <div>
                  <h3 className="font-bold">No notes match your filters</h3>
                  <div className="text-sm">
                    Try adjusting the search, tab, or word count slider to see
                    more notes.
                  </div>
                </div>
              </div>
            )}

            {!loading && !isRateLimited && notes.length === 0 && (
              <NotesNotFound />
            )}
          </section>
        </main>
      </div>

      <div className="drawer-side z-30">
        <label
          htmlFor="notes-filters"
          className="drawer-overlay"
          onClick={closeDrawer}
        />
        <div className="menu h-full w-80 max-w-full gap-6 overflow-y-auto bg-base-200 p-6">
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Filter details</h2>
          </div>

          <label className="form-control w-full">
            <span className="label">
              <span className="label-text">Search</span>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title or content"
              className="input input-bordered w-full"
            />
          </label>

          <label className="form-control w-full">
            <span className="label">
              <span className="label-text">Minimum words ({minWords})</span>
            </span>
            <input
              type="range"
              className="range range-primary"
              min="0"
              max="400"
              step="20"
              value={minWords}
              onChange={(event) => setMinWords(event.target.value)}
            />
            <div className="flex w-full justify-between text-xs px-1">
              {[0, 100, 200, 300, 400].map((marker) => (
                <span key={marker}>{marker}</span>
              ))}
            </div>
          </label>

          <label className="form-control w-full">
            <span className="label">
              <span className="label-text">Sort notes</span>
            </span>
            <select
              className="select select-bordered"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="updated">Recently updated</option>
            </select>
          </label>

          <div className="divider">Tips</div>
          <ul className="timeline timeline-vertical timeline-compact">
            <li>
              <div className="timeline-middle">
                <FilterIcon className="size-4" />
              </div>
              <div className="timeline-end mb-4">
                <h4 className="font-semibold">Use search shortcuts</h4>
                <p className="text-sm text-base-content/70">
                  Filter by keywords, then adjust the word slider to focus on
                  short summaries or long-form notes.
                </p>
              </div>
            </li>
            <li>
              <div className="timeline-middle">
                <SparklesIcon className="size-4" />
              </div>
              <div className="timeline-end mb-4">
                <h4 className="font-semibold">Switch tabs quickly</h4>
                <p className="text-sm text-base-content/70">
                  Tabs let you jump between recent captures, long reads, or
                  quick thoughts.
                </p>
              </div>
            </li>
          </ul>

          <button
            type="button"
            className="btn btn-primary"
            onClick={closeDrawer}
          >
            Close filters
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
