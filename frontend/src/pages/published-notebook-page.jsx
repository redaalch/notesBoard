import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/axios";
import Navbar from "../Components/Navbar.jsx";
import NoteSkeleton from "../Components/NoteSkeleton.jsx";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDateTime = (value) => {
  if (!value) return null;
  try {
    return dateTimeFormatter.format(new Date(value));
  } catch {
    return null;
  }
};

const PublishedNotebookPage = () => {
  const { slug } = useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["published-notebook", slug],
    enabled: Boolean(slug),
    retry: false,
    queryFn: async () => {
      const response = await api.get(`/published/notebooks/${slug}`);
      return response.data;
    },
  });

  const title = data?.notebook?.name ?? "Published Notebook";
  const description = data?.notebook?.description ?? "";
  const notes = Array.isArray(data?.notes) ? data.notes : [];

  const { publishedAt, updatedAt } = useMemo(
    () => ({
      publishedAt: formatDateTime(
        data?.publishedAt ?? data?.notebook?.publishedAt,
      ),
      updatedAt: formatDateTime(data?.updatedAt),
    }),
    [data?.publishedAt, data?.updatedAt, data?.notebook?.publishedAt],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <Navbar hideAuthLinks />
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="mb-6 h-10 w-2/3 animate-pulse rounded-lg bg-base-300" />
          <div className="mb-10 h-6 w-1/2 animate-pulse rounded bg-base-300" />
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <NoteSkeleton key={idx} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    const message =
      error?.response?.data?.message ??
      "Unable to load this published notebook.";
    return (
      <div className="min-h-screen bg-base-200">
        <Navbar hideAuthLinks />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="mb-4 text-3xl font-semibold text-base-content">
            Notebook unavailable
          </h1>
          <p className="mb-8 text-base text-base-content/80">{message}</p>
          <Link className="btn btn-primary" to="/">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (!data || !data.notebook) {
    return (
      <div className="min-h-screen bg-base-200">
        <Navbar hideAuthLinks />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="mb-4 text-3xl font-semibold text-base-content">
            Notebook unavailable
          </h1>
          <p className="mb-8 text-base text-base-content/80">
            This published notebook could not be found or is no longer
            available.
          </p>
          <Link className="btn btn-primary" to="/">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Navbar hideAuthLinks />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-base-content">{title}</h1>
          {description ? (
            <p className="mt-3 text-base text-base-content/80">{description}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-base-content/70">
            {publishedAt ? <span>Published {publishedAt}</span> : null}
            {updatedAt ? <span>Last updated {updatedAt}</span> : null}
            {data?.metadata && Object.keys(data.metadata).length ? (
              <span title="Metadata available">SEO metadata provided</span>
            ) : null}
          </div>
        </header>

        {notes.length === 0 ? (
          <div className="rounded-xl border border-base-300 bg-base-100 p-10 text-center">
            <h2 className="text-2xl font-semibold text-base-content">
              Nothing to show yet
            </h2>
            <p className="mt-3 text-sm text-base-content/70">
              This notebook was published without any visible notes.
            </p>
          </div>
        ) : (
          <section className="grid gap-6 sm:grid-cols-2">
            {notes.map((note) => (
              <article
                key={note.id}
                className="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
              >
                {note.pinned ? (
                  <span className="badge badge-primary mb-3">Pinned</span>
                ) : null}
                <h2 className="text-xl font-semibold text-base-content">
                  {note.title || "Untitled note"}
                </h2>
                {note.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {note.tags.map((tag) => (
                      <span key={tag} className="badge badge-outline">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-base-content/90">
                  {note.contentText ||
                    note.content ||
                    "This note has no content."}
                </p>
                <footer className="mt-6 text-xs text-base-content/60">
                  {note.updatedAt ? (
                    <div>Updated {formatDateTime(note.updatedAt)}</div>
                  ) : note.createdAt ? (
                    <div>Created {formatDateTime(note.createdAt)}</div>
                  ) : null}
                </footer>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};

export default PublishedNotebookPage;
