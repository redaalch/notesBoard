import { NotebookIcon } from "lucide-react";
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
    <div className="hero min-h-[28rem] rounded-2xl bg-base-200">
      <div className="hero-content flex-col text-center lg:flex-row-reverse lg:text-left">
        <div className="avatar placeholder">
          <div className="bg-primary/15 text-primary rounded-full w-28">
            <NotebookIcon className="size-10" />
          </div>
        </div>
        <div className="max-w-xl space-y-4">
          <h3 className="text-3xl font-bold">Your notebook is waiting</h3>
          <p className="text-base-content/70">
            Capture ideas, plans, or insights with a single click. Start your
            first note and watch your workspace come alive.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/create" state={linkState} className="btn btn-primary">
              Create your first note
            </Link>
            <Link to="/create" state={linkState} className="btn btn-outline">
              Use a quick capture
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesNotFound;
