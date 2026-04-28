import { NotebookIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface NotesNotFoundProps {
  createLinkState?: Record<string, unknown>;
}

const NotesNotFound = ({ createLinkState = undefined }: NotesNotFoundProps) => {
  const linkState =
    createLinkState && Object.keys(createLinkState).length
      ? createLinkState
      : undefined;

  return (
    <div className="ds-empty">
      <div className="ds-empty-icon">
        <NotebookIcon size={20} />
      </div>
      <h3>Your notebook is waiting</h3>
      <p>
        Capture ideas, plans, or insights with a single click. Start your first
        note and watch your workspace come alive.
      </p>
      <div className="ds-empty-actions">
        <Link to="/create" state={linkState} className="ds-chip on">
          <PlusIcon size={12} /> Create your first note
        </Link>
        <Link to="/create" state={linkState} className="ds-chip">
          <SparklesIcon size={12} /> Use a quick capture
        </Link>
      </div>
    </div>
  );
};

export default NotesNotFound;
