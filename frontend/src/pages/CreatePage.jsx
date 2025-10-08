import { ArrowLeftIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../lib/axios";
import TagInput from "../Components/TagInput.jsx";
import TemplateGalleryModal from "../Components/TemplateGalleryModal.jsx";
import { useCommandPalette } from "../contexts/CommandPaletteContext.jsx";
import { normalizeTag } from "../lib/Utils.js";

const CreatePage = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState([]);
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { registerCommands } = useCommandPalette();

  const applyTemplate = useCallback((template) => {
    if (!template) return;

    setTitle(template.title ?? "");
    setContent(template.content ?? "");
    setTags(
      Array.isArray(template.tags)
        ? template.tags.map((tag) => normalizeTag(tag)).filter(Boolean)
        : []
    );
    setPinned(Boolean(template.pinned));
    setActiveTemplate(template);
    toast.success(`Loaded the ${template.name} template`);
  }, []);

  useEffect(() => {
    const incomingTemplate = location.state?.template;
    if (incomingTemplate) {
      applyTemplate(incomingTemplate);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [applyTemplate, location.pathname, location.state, navigate]);

  useEffect(() => {
    const cleanup = registerCommands([
      {
        id: "create:open-templates",
        label: "Browse note templates",
        section: "Compose",
        action: () => setTemplateModalOpen(true),
      },
    ]);
    return cleanup;
  }, [registerCommands]);

  const handleTemplateSelect = (template) => {
    if (!template) return;
    setTemplateModalOpen(false);
    applyTemplate(template);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error("All fields are required");
      return;
    }

    setLoading(true);
    try {
      await api.post("/notes", {
        title,
        content,
        tags,
        pinned,
      });

      toast.success("Note created successfully!");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["notes"] }),
        queryClient.invalidateQueries({ queryKey: ["tag-stats"] }),
      ]);
      navigate("/app");
    } catch (error) {
      console.error("Error creating note", error);
      if (error.response?.status === 429) {
        toast.error("Slow down! You're creating notes too fast", {
          duration: 4000,
          icon: "💀",
        });
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to create note");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200">
      <main
        id="main-content"
        tabIndex={-1}
        className="container mx-auto px-4 py-8"
      >
        <div className="max-w-2xl mx-auto">
          <Link to={"/app"} className="btn btn-ghost mb-6">
            <ArrowLeftIcon className="size-5" />
            Back to Notes
          </Link>

          <div className="card bg-base-100">
            <div className="card-body">
              <h2 className="card-title text-2xl mb-4">Create New Note</h2>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-base-300/60 bg-base-200/70 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-base-content/70">
                  <SparklesIcon className="size-4 text-primary" />
                  <span>
                    {activeTemplate
                      ? `Template in use: ${activeTemplate.name}`
                      : "Start from scratch or pick a template."}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setTemplateModalOpen(true)}
                >
                  Browse templates
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Title</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Note Title"
                    className="input input-bordered"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">Content</span>
                  </label>
                  <textarea
                    placeholder="Write your note here..."
                    className="textarea textarea-bordered h-32"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div className="form-control mb-6">
                  <label className="label">
                    <span className="label-text">Tags</span>
                    <span className="label-text-alt text-base-content/60">
                      Press Enter to add up to 8 tags
                    </span>
                  </label>
                  <TagInput value={tags} onChange={setTags} />
                </div>

                <div className="form-control mb-6">
                  <label className="label cursor-pointer justify-start gap-4">
                    <span className="label-text font-semibold">
                      Pin this note
                    </span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={pinned}
                      onChange={(event) => setPinned(event.target.checked)}
                    />
                  </label>
                  <span className="label-text-alt text-base-content/60">
                    Pinned notes stay at the top of your dashboard.
                  </span>
                </div>

                <div className="card-actions justify-end">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Creating..." : "Create Note"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="mt-10 space-y-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              Build a brilliant note
            </h3>
            <ul className="steps steps-vertical lg:steps-horizontal">
              <li className="step step-primary" data-content="✏️">
                Jot the headline — keep titles short and searchable.
              </li>
              <li className="step step-secondary" data-content="🧠">
                Capture the core idea before the details fade away.
              </li>
              <li className="step step-accent" data-content="✅">
                Add clear action items or next steps.
              </li>
              <li className="step" data-content="✨">
                Tag or highlight key phrases for quick scanning later.
              </li>
            </ul>
          </div>
        </div>
      </main>
      <TemplateGalleryModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
};
export default CreatePage;
