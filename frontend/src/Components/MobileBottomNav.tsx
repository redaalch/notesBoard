import { Home, Search, Plus, User, type LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  special?: boolean;
}

export const MobileBottomNav = () => {
  const location = useLocation();

  const navItems: NavItem[] = [
    { icon: Home, label: "Home", path: "/home" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: Plus, label: "New", path: "/create", special: true },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <nav className="btm-nav md:hidden bg-base-100 border-t border-base-200 glass-navbar">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`relative ${isActive ? "active" : ""}`}
          >
            {item.special ? (
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="btn btn-primary btn-circle btn-sm"
              >
                <Icon className="w-5 h-5" />
              </motion.div>
            ) : (
              <>
                <Icon className="w-5 h-5" />
                <span className="btm-nav-label text-xs">{item.label}</span>

                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
