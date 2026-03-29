import type { LucideIcon } from "lucide-react";

/**
 * Application-wide icon type alias.
 * All component interfaces should use `AppIcon` instead of importing
 * `LucideIcon` directly — this creates a single point of change
 * if the icon library is ever swapped.
 */
export type AppIcon = LucideIcon;
