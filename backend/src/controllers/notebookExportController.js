import archiver from "archiver";
import Note from "../models/Note.js";
import Notebook from "../models/Notebook.js";
import { resolveWorkspaceForUser } from "../utils/access.js";
import {
  ensureNotebookOwnership,
  normalizeObjectId,
} from "../utils/notebooks.js";
import logger from "../utils/logger.js";
import {
  getNotebookMembership,
} from "../utils/access.js";

const sanitizeFileName = (value, fallback = "note") => {
  const base = String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return base || fallback;
};

const uniqueFileName = (title, used) => {
  const base = sanitizeFileName(title || "Untitled");
  let candidate = `${base}.md`;
  let counter = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${counter}).md`;
    counter += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

const buildNoteMarkdown = (note) => {
  const frontmatter = [];
  frontmatter.push("---");
  frontmatter.push(`title: ${JSON.stringify(note.title ?? "Untitled")}`);
  if (Array.isArray(note.tags) && note.tags.length) {
    frontmatter.push(`tags: [${note.tags.map((t) => JSON.stringify(t)).join(", ")}]`);
  }
  if (note.createdAt) frontmatter.push(`created: ${new Date(note.createdAt).toISOString()}`);
  if (note.updatedAt) frontmatter.push(`updated: ${new Date(note.updatedAt).toISOString()}`);
  if (note.pinned) frontmatter.push(`pinned: true`);
  frontmatter.push("---");
  const body = note.contentText ?? note.content ?? "";
  return `${frontmatter.join("\n")}\n\n# ${note.title ?? "Untitled"}\n\n${body}\n`;
};

export const exportNotebookBundle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const objectId = normalizeObjectId(id);
    if (!objectId) {
      return res.status(400).json({ message: "Invalid notebook ID" });
    }

    // Allow owners OR notebook members (viewer+) to export
    let notebook = await ensureNotebookOwnership(id, userId);
    if (!notebook) {
      const membership = await getNotebookMembership(id, userId);
      if (!membership || membership.status !== "active") {
        return res.status(404).json({ message: "Notebook not found" });
      }
      notebook = await Notebook.findById(id).lean();
      if (!notebook) {
        return res.status(404).json({ message: "Notebook not found" });
      }
    }

    const workspaceContext = await resolveWorkspaceForUser(
      notebook.workspaceId,
      userId,
    );
    if (!workspaceContext && String(notebook.owner) !== String(userId)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const notes = await Note.find({
      notebookId: notebook._id,
    })
      .sort({ pinned: -1, updatedAt: -1 })
      .lean();

    const safeName = sanitizeFileName(notebook.name || "notebook", "notebook");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.zip"`,
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      logger.error("Notebook export archive error", { error: err?.message });
      try {
        res.status(500).end();
      } catch {
        // response likely already partially flushed
      }
    });
    archive.pipe(res);

    const usedNames = new Set();
    const noteManifest = notes.map((note) => {
      const fileName = uniqueFileName(note.title, usedNames);
      archive.append(buildNoteMarkdown(note), { name: `notes/${fileName}` });
      return {
        id: note._id.toString(),
        title: note.title ?? "Untitled",
        fileName: `notes/${fileName}`,
        tags: Array.isArray(note.tags) ? note.tags : [],
        pinned: Boolean(note.pinned),
        createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : null,
        updatedAt: note.updatedAt ? new Date(note.updatedAt).toISOString() : null,
      };
    });

    const metadata = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      notebook: {
        id: notebook._id.toString(),
        name: notebook.name ?? "Untitled notebook",
        description: notebook.description ?? "",
        color: notebook.color ?? null,
        icon: notebook.icon ?? null,
        createdAt: notebook.createdAt
          ? new Date(notebook.createdAt).toISOString()
          : null,
        updatedAt: notebook.updatedAt
          ? new Date(notebook.updatedAt).toISOString()
          : null,
      },
      notes: noteManifest,
    };

    archive.append(JSON.stringify(metadata, null, 2), {
      name: "metadata.json",
    });

    archive.append(
      `# ${notebook.name ?? "Untitled notebook"}\n\n${notebook.description ?? ""}\n\nExported from NotesBoard on ${new Date().toISOString()}.\nThis archive contains ${noteManifest.length} note${noteManifest.length === 1 ? "" : "s"}.\n`,
      { name: "README.md" },
    );

    await archive.finalize();
  } catch (error) {
    logger.error("Notebook export failed", { error: error?.message });
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to export notebook" });
    }
  }
};
