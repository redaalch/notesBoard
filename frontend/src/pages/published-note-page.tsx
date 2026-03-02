import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/axios";
import Navbar from "../Components/Navbar";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDateTime = (value: string | number | Date | null | undefined) => {
  if (!value) return null;
  try {
    return dateTimeFormatter.format(new Date(value as string | number | Date));
  } catch {
    return null;
  }
};

const PublishedNotePage = () => {
  const { slug } = useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["published-note", slug],
    enabled: Boolean(slug),
    retry: false,
    queryFn: async () => {
      const response = await api.get(`/published/notes/${slug}`);
      return response.data;
    },
  });

  const note = data?.note ?? null;

  const { publishedAt, updatedAt } = useMemo(
    () => ({
      publishedAt: formatDateTime(data?.publishedAt),
      updatedAt: formatDateTime(data?.updatedAt),
    }),
    [data?.publishedAt, data?.updatedAt],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200">
        <Navbar hideAuthLinks />
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="mb-6 h-10 w-2/3 animate-pulse rounded-lg bg-base-300" />
          <div className="mb-4 h-5 w-1/3 animate-pulse rounded bg-base-300" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-4 animate-pulse rounded bg-base-300"
                style={{ width: `${80 - idx * 8}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    const message =
      (error as any)?.response?.data?.message ??
      "Unable to load this published note.";
    return (
      <div className="min-h-screen bg-base-200">
        <Navbar hideAuthLinks />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="mb-4 text-3xl font-semibold text-base-content">
            Note unavailable
          </h1>
          <p className="mb-8 text-base text-base-content/80">{message}</p>
          <Link className="btn btn-primary" to="/">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-base-200">
        <Navbar hideAuthLinks />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="mb-4 text-3xl font-semibold text-base-content">
            Note unavailable
          </h1>
          <p className="mb-8 text-base text-base-content/80">
            This published note could not be found or is no longer available.
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
      <main className="mx-auto max-w-3xl px-4 py-12">
        <article className="rounded-xl border border-base-300 bg-base-100 p-8 shadow-sm sm:p-10">
          {note.pinned ? (
            <span className="badge badge-primary mb-4">Pinned</span>
          ) : null}

          <h1 className="text-3xl font-bold text-base-content sm:text-4xl">
            {note.title || "Untitled note"}
          </h1>

          {note.tags?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {note.tags.map((tag: string) => (
                <span key={tag} className="badge badge-outline">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-base-content/60">
            {publishedAt ? <span>Published {publishedAt}</span> : null}
            {updatedAt ? <span>Last updated {updatedAt}</span> : null}
          </div>

          <div className="divider" />

          {note.richContent ? (
            <div
              className="prose prose-lg max-w-none leading-relaxed text-base-content"
              dangerouslySetInnerHTML={{ __html: note.richContent }}
            />
          ) : (
            <div className="prose prose-lg max-w-none whitespace-pre-wrap leading-relaxed text-base-content">
              {note.contentText || note.content || "This note has no content."}
            </div>
          )}
        </article>

        <footer className="mt-8 text-center">
          <Link className="btn btn-ghost btn-sm" to="/">
            &larr; Back to home
          </Link>
        </footer>
      </main>
    </div>
  );
};

export default PublishedNotePage;
