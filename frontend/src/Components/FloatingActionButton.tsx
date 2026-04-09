import { m, AnimatePresence } from "framer-motion";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { AppIcon } from "../types/icon";

export interface FabAction {
  label: string;
  onClick: () => void;
  icon: AppIcon;
}

export interface FloatingActionButtonProps {
  actions?: FabAction[];
}

export const FloatingActionButton = ({ actions = [] }: FloatingActionButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-20 right-6 md:bottom-8 md:right-8 z-40">
      <AnimatePresence>
        {isOpen && actions.length > 0 && (
          <m.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            className="absolute bottom-16 right-0 flex flex-col gap-3"
          >
            {actions.map((action, index) => (
              <m.button
                key={action.label}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => {
                  action.onClick();
                  setIsOpen(false);
                }}
                className="btn btn-circle btn-sm shadow-lg"
                title={action.label}
              >
                <action.icon className="size-4" />
              </m.button>
            ))}
          </m.div>
        )}
      </AnimatePresence>

      <m.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-primary btn-circle btn-lg shadow-2xl"
      >
        <m.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          {isOpen ? <XIcon className="size-6" /> : <PlusIcon className="size-6" />}
        </m.div>
      </m.button>
    </div>
  );
};

export default FloatingActionButton;
