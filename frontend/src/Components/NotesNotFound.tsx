import { motion } from "framer-motion";
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
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="hero min-h-[28rem] rounded-2xl bg-base-200"
    >
      <div className="hero-content flex-col text-center lg:flex-row-reverse lg:text-left">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
          className="avatar placeholder"
        >
          <div className="bg-primary/15 text-primary rounded-full w-28">
            <NotebookIcon className="size-10" />
          </div>
        </motion.div>
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
    </motion.div>
  );
};

export default NotesNotFound;
