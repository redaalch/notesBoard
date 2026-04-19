import AdmZip from "adm-zip";
import mongoose from "mongoose";
import Note from "../models/Note.js";
import Notebook from "../models/Notebook.js";
import NoteHistory from "../models/NoteHistory.js";
import { resolveWorkspaceForUser, touchWorkspaceMember } from "../utils/access.js";
import logger from "../utils/logger.js";

const MAX_FILES = 200;
const MAX_NOTE_CONTENT = 50_000;
const MAX_TAGS_PER_NOTE = 20;
const MAX_TAG_LENGTH = 50;
const MAX_TITLE_LENGTH = 200;

const stripFrontmatter = (raw) => {
  if (!raw.startsWith("---")) return { frontmatter: null, body: raw };
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: null, body: raw };
  return { frontmatter: match[1], body: raw.slice(match[0].length) };
};

const parseFrontmatter = (fm) => {
  if (!fm) return {};
  const result = {};
  fm.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (!key) return;
    if (/^\[.*\]$/.test(value)) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          result[key] = parsed.map((v) => String(v));
          return;
        }
      } catch {
        // fall through to raw
      }
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      return;
    }
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  });
  return result;
};

const extractTitleFromBody = (body) => {
  const heading = body.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim().slice(0, MAX_TITLE_LENGTH);
  const firstLine = body
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  return firstLine ? firstLine.trim().slice(0, MAX_TITLE_LENGTH) : "Untitled";
};

const sanitizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const out = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const normalized = raw.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (!normalized) continue;
    if (!out.includes(normalized)) out.push(normalized);
    if (out.length >= MAX_TAGS_PER_NOTE) break;
  }
  return out;
};

const markdownToHtml = (markdown) => {
  const escape = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let inCode = false;
  let codeLines = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(" ").trim();
    if (joined) blocks.push(`<p>${escape(joined)}</p>`);
    paragraph = [];
  };
  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        blocks.push(`<pre><code>${escape(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      blocks.push(`<h${level}>${escape(heading[2].trim())}</h${level}>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      blocks.push(`<ul><li>${escape(line.replace(/^\s*[-*]\s+/, ""))}</li></ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph();
      blocks.push(`<ol><li>${escape(line.replace(/^\s*\d+\.\s+/, ""))}</li></ol>`);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  if (inCode && codeLines.length) {
    blocks.push(`<pre><code>${escape(codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  return blocks.join("\n") || "<p></p>";
};

const buildNoteFromMarkdown = ({ filename, raw }) => {
  const { frontmatter, body } = stripFrontmatter(raw);
  const meta = parseFrontmatter(frontmatter);
  const rawTitle =
    meta.title ||
    filename.replace(/\.(md|markdown)$/i, "").replace(/[-_]+/g, " ").trim() ||
    extractTitleFromBody(body);
  const title = String(rawTitle).slice(0, MAX_TITLE_LENGTH) || "Untitled";
  const contentText = body.slice(0, MAX_NOTE_CONTENT);
  const html = markdownToHtml(contentText);
  const tags = sanitizeTags(meta.tags);
  return {
    title,
    content: html.slice(0, MAX_NOTE_CONTENT),
    contentText,
    tags,
  };
};

const normalizeNotebookName = (raw, fallback = "Imported notebook") => {
  const base = String(raw ?? "")
    .trim()
    .slice(0, 120);
  return base || fallback;
};

const collectMarkdownEntries = (buffer) => {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((entry) => {
    if (entry.isDirectory) return false;
    const name = entry.entryName;
    if (name.includes("__MACOSX/")) return false;
    return /\.(md|markdown)$/i.test(name);
  });
  if (entries.length > MAX_FILES) {
    const err = new Error(
      `ZIP contains too many markdown files (max ${MAX_FILES})`,
    );
    err.statusCode = 413;
    throw err;
  }
  return entries.map((entry) => ({
    filename: entry.entryName.split("/").pop(),
    raw: entry.getData().toString("utf8"),
  }));
};

export const importNotebook = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { originalname, mimetype, buffer } = req.file;
    if (!buffer?.length) {
      return res.status(400).json({ message: "Uploaded file is empty" });
    }

    const isZip =
      mimetype === "application/zip" ||
      mimetype === "application/x-zip-compressed" ||
      /\.zip$/i.test(originalname ?? "");
    const isMarkdown =
      mimetype === "text/markdown" ||
      mimetype === "text/x-markdown" ||
      /\.(md|markdown)$/i.test(originalname ?? "");

    if (!isZip && !isMarkdown) {
      return res
        .status(400)
        .json({ message: "Only .md or .zip files are supported" });
    }

    const workspaceContext = await resolveWorkspaceForUser(
      req.body?.workspaceId ?? req.user?.defaultWorkspace,
      userId,
    );
    if (!workspaceContext) {
      return res
        .status(404)
        .json({ message: "Workspace not found or inaccessible" });
    }
    const role = workspaceContext.member?.role ?? "owner";
    const writeRoles = new Set(["owner", "admin", "editor"]);
    if (!writeRoles.has(role)) {
      return res
        .status(403)
        .json({ message: "Insufficient workspace permissions" });
    }
    await touchWorkspaceMember(workspaceContext.workspace._id, userId);

    let entries = [];
    let notebookName = normalizeNotebookName(
      req.body?.notebookName ?? originalname?.replace(/\.(zip|md|markdown)$/i, ""),
    );

    if (isZip) {
      entries = collectMarkdownEntries(buffer);
      if (!entries.length) {
        return res
          .status(400)
          .json({ message: "No markdown files found in ZIP" });
      }
    } else {
      entries = [
        {
          filename: originalname ?? "note.md",
          raw: buffer.toString("utf8"),
        },
      ];
    }

    const notebook = await Notebook.create({
      owner: userId,
      workspaceId: workspaceContext.workspace._id,
      name: notebookName,
      description: `Imported from ${originalname ?? "upload"} on ${new Date().toISOString()}`,
    });

    const createdNotes = [];
    for (const entry of entries) {
      try {
        const noteData = buildNoteFromMarkdown(entry);
        const note = await Note.create({
          owner: userId,
          workspaceId: workspaceContext.workspace._id,
          notebookId: notebook._id,
          title: noteData.title,
          content: noteData.content || "<p></p>",
          contentText: noteData.contentText,
          tags: noteData.tags,
        });
        await NoteHistory.create({
          noteId: note._id,
          workspaceId: note.workspaceId,
          actorId: userId,
          eventType: "create",
          summary: `Imported from ${entry.filename}`,
          titleSnapshot: note.title,
          contentSnapshot: (note.contentText ?? "").slice(0, 50_000),
          tagsSnapshot: note.tags,
        });
        createdNotes.push({
          id: note._id.toString(),
          title: note.title,
          tags: note.tags,
        });
      } catch (entryError) {
        logger.warn("Skipping markdown entry during import", {
          filename: entry.filename,
          error: entryError?.message,
        });
      }
    }

    if (!createdNotes.length) {
      // Nothing usable — roll back notebook creation
      await Notebook.deleteOne({ _id: notebook._id });
      return res
        .status(422)
        .json({ message: "No notes could be imported from the upload" });
    }

    if (createdNotes.length) {
      await Notebook.updateOne(
        { _id: notebook._id },
        {
          $set: {
            noteOrder: createdNotes.map((n) => new mongoose.Types.ObjectId(n.id)),
          },
        },
      );
    }

    return res.status(201).json({
      notebook: {
        id: notebook._id.toString(),
        name: notebook.name,
      },
      importedCount: createdNotes.length,
      skippedCount: entries.length - createdNotes.length,
      notes: createdNotes,
    });
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    logger.error("Notebook import failed", { error: error?.message });
    return res.status(500).json({ message: "Failed to import notebook" });
  }
};
