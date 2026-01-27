# Design System Implementation - Quick Start Guide

## ✅ What's Been Completed (Phase 1)

### Design Tokens & Foundation

All design tokens have been established in `/frontend/src/index.css`:

- ✅ Spacing scale (4px base: space-1 through space-32)
- ✅ Enhanced shadow system (xs, sm, md, lg, xl, 2xl, glow)
- ✅ Color system refined (2 neutrals + 1 accent)
- ✅ Border radius tokens (xs through 3xl, full)
- ✅ Typography hierarchy (8 text styles with responsive scaling)

### Theme System

- ✅ Consolidated from 10+ themes to **2 curated themes**:
  - `notesLight`: Bright, calm, data-friendly
  - `notesDark`: Dim, focused, reduced eye strain
- ✅ Updated `index.html` theme initialization
- ✅ Updated `tailwind.config.js` with new spacing and shadow tokens
- ✅ Navbar theme switcher already properly implemented

### Component Library (`/frontend/src/Components/ui/`)

All base UI primitives are complete and ready to use:

1. **Button.jsx** - 8 variants with full accessibility
2. **Surface.jsx** - 5 elevation levels (base, raised, overlay, inset, glass)
3. **Stack.jsx** - Flexbox layout primitive
4. **Card.jsx** - Structured content container
5. **Chip.jsx** - Interactive tags with remove option
6. **Tag.jsx** - Static labels
7. **MetricTile.jsx** - KPI display with trends
8. **Icon.jsx** - NEW: Consistent icon wrapper
9. **Container.jsx** - NEW: Page width constraint
10. **Section.jsx** - NEW: Vertical spacing primitive

All components are exported from `/frontend/src/Components/ui/index.js`

---

## 🚀 Next Steps - Phase 2: Dashboard Overhaul

### Priority 1: Update HomePage.jsx Metrics Section

**Current State:** HomePage likely has a horizontal KPI strip or scattered stats
**Goal:** Replace with 3-card responsive metric summary using MetricTile

**Implementation:**

```jsx
import { Container, Stack, MetricTile } from "../Components/ui";
import { NotebookIcon, UsersIcon, TrendingUpIcon } from "lucide-react";

// In HomePage.jsx, replace existing metrics section with:
<Container size="lg">
  <Stack
    direction="row"
    gap="md"
    wrap
    className="grid grid-cols-1 md:grid-cols-3 gap-4"
  >
    <MetricTile
      label="Total Notes"
      value={stats.totalNotes}
      sublabel="Across all notebooks"
      trend={{
        direction: stats.notesTrend > 0 ? "up" : "down",
        label: `${Math.abs(stats.notesTrend)}% vs last month`,
      }}
      icon={<NotebookIcon className="size-5" />}
    />

    <MetricTile
      label="Collaborators"
      value={stats.collaborators}
      sublabel="Active this week"
      trend={{
        direction: "neutral",
        label: "No change",
      }}
      icon={<UsersIcon className="size-5" />}
    />

    <MetricTile
      label="Activity Score"
      value={stats.activityScore}
      sublabel="Based on engagement"
      trend={{
        direction: "up",
        label: "+24 points",
      }}
      icon={<TrendingUpIcon className="size-5" />}
    />
  </Stack>
</Container>;
```

**Files to modify:**

- `/frontend/src/pages/HomePage.jsx`

---

### Priority 2: Create Notebook Selector Left Rail

**Goal:** Extract notebook selection into a collapsible left sidebar on desktop, drawer on mobile

**Create new component:** `/frontend/src/Components/NotebookRail.jsx`

```jsx
import { Button, Surface, Stack, Chip } from "./ui";
import {
  NotebookIcon,
  PlusIcon,
  Share2Icon,
  BarChart3Icon,
} from "lucide-react";

function NotebookRail({
  notebooks,
  activeNotebookId,
  onSelect,
  onQuickCreate,
  onShare,
  onAnalytics,
}) {
  return (
    <Surface variant="raised" padding="md" className="h-full overflow-y-auto">
      <Stack direction="column" gap="md">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="typ-section-label">Notebooks</h2>
          <Button
            variant="ghost"
            size="xs"
            icon={<PlusIcon />}
            onClick={onQuickCreate}
          />
        </div>

        {/* Notebook List */}
        <Stack direction="column" gap="xs">
          {notebooks.map((notebook) => (
            <button
              key={notebook.id}
              onClick={() => onSelect(notebook.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                activeNotebookId === notebook.id
                  ? "bg-brand-50 text-brand-700"
                  : "hover:bg-neutral-50"
              )}
            >
              <NotebookIcon className="size-4" />
              <span className="flex-1 text-left typ-body-sm">
                {notebook.name}
              </span>
              <Chip tone="neutral" variant="subtle" size="xs">
                {notebook.noteCount}
              </Chip>
            </button>
          ))}
        </Stack>

        {/* Quick Actions */}
        <div className="border-t pt-4 mt-auto">
          <Stack direction="row" gap="xs">
            <Button
              variant="subtle"
              size="sm"
              icon={<Share2Icon />}
              onClick={onShare}
              fullWidth
            >
              Share
            </Button>
            <Button
              variant="subtle"
              size="sm"
              icon={<BarChart3Icon />}
              onClick={onAnalytics}
              fullWidth
            >
              Analytics
            </Button>
          </Stack>
        </div>
      </Stack>
    </Surface>
  );
}

export default NotebookRail;
```

**Integrate into HomePage.jsx:**

```jsx
// Add to HomePage layout
<div className="flex gap-6">
  {/* Left Rail - Desktop Only */}
  <aside className="hidden laptop:block w-64 shrink-0">
    <NotebookRail
      notebooks={notebooks}
      activeNotebookId={activeNotebookId}
      onSelect={setActiveNotebookId}
      onQuickCreate={handleQuickCreate}
      onShare={handleShare}
      onAnalytics={handleAnalytics}
    />
  </aside>

  {/* Main Content */}
  <main className="flex-1 min-w-0">{/* Existing content */}</main>
</div>
```

**Files to create:**

- `/frontend/src/Components/NotebookRail.jsx`

**Files to modify:**

- `/frontend/src/pages/HomePage.jsx`

---

### Priority 3: Create Sticky Workspace Toolbar

**Goal:** Unified filter/search/view toolbar that stays visible while scrolling

**Create new component:** `/frontend/src/Components/WorkspaceToolbar.jsx`

```jsx
import { Button, Chip, Stack, Icon } from "./ui";
import {
  SearchIcon,
  FilterIcon,
  SlidersHorizontalIcon,
  BookmarkIcon,
} from "lucide-react";

function WorkspaceToolbar({
  activeFilters,
  onFilterChange,
  onSearchChange,
  savedViews,
  activeSavedView,
  onSavedViewSelect,
}) {
  return (
    <div className="sticky top-16 z-30 surface-raised shadow-md">
      <Container>
        <Stack direction="row" gap="md" align="center" className="py-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Icon
              size="sm"
              className="absolute left-3 top-1/2 -translate-y-1/2"
            >
              <SearchIcon />
            </Icon>
            <input
              type="search"
              placeholder="Search notes..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>

          {/* Active Filters */}
          <Stack direction="row" gap="xs" wrap>
            {activeFilters.map((filter) => (
              <Chip
                key={filter.id}
                tone="primary"
                variant="subtle"
                onRemove={() => onFilterChange(filter.id, null)}
              >
                {filter.label}
              </Chip>
            ))}
          </Stack>

          {/* Actions */}
          <Stack direction="row" gap="xs" className="ml-auto">
            <Button variant="subtle" size="sm" icon={<FilterIcon />}>
              Filter
            </Button>
            <Button variant="subtle" size="sm" icon={<SlidersHorizontalIcon />}>
              Sort
            </Button>

            {/* Saved Views Dropdown */}
            <div className="dropdown dropdown-end">
              <Button variant="subtle" size="sm" icon={<BookmarkIcon />}>
                Views
              </Button>
              <ul className="dropdown-content surface-overlay shadow-lg p-2 rounded-xl w-64 mt-2">
                {savedViews.map((view) => (
                  <li key={view.id}>
                    <button
                      onClick={() => onSavedViewSelect(view.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg",
                        activeSavedView === view.id && "bg-brand-50"
                      )}
                    >
                      {view.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Stack>
        </Stack>
      </Container>
    </div>
  );
}

export default WorkspaceToolbar;
```

**Files to create:**

- `/frontend/src/Components/WorkspaceToolbar.jsx`

**Files to modify:**

- `/frontend/src/pages/HomePage.jsx` (integrate toolbar above note grid)

---

## 🎨 Phase 3: Component Updates

### Update NoteCard.jsx

**Goals:**

- Reduce badge clutter (max 3 visible tags + "N more")
- Move pin/share/delete into hover toolbar
- Surface collaborators in footer
- Add inline tag quick-add

**Key Changes:**

```jsx
// Replace top badge row with simplified version
<Stack direction="row" gap="xs" wrap className="max-w-full">
  {note.tags.slice(0, 3).map(tag => (
    <Tag key={tag} tone="neutral" variant="subtle">{tag}</Tag>
  ))}
  {note.tags.length > 3 && (
    <Tag tone="neutral" variant="outline">+{note.tags.length - 3}</Tag>
  )}
</Stack>

// Add hover toolbar
<div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
  <Stack direction="row" gap="xs">
    <Button variant="ghost" size="xs" icon={<PinIcon />} />
    <Button variant="ghost" size="xs" icon={<Share2Icon />} />
    <Button variant="destructive" size="xs" icon={<Trash2Icon />} />
  </Stack>
</div>

// Add footer with collaborators
<div className="border-t pt-3 mt-4">
  <Stack direction="row" justify="between" align="center">
    <PresenceAvatars users={note.collaborators} max={3} />
    <span className="typ-meta">{formatDate(note.updatedAt)}</span>
  </Stack>
</div>
```

---

## 📚 Reference

### Import Pattern

```jsx
// Always import from ui/index.js
import { Button, Card, Stack, Surface, MetricTile } from "@/Components/ui";
```

### Responsive Utilities

```jsx
// Use Tailwind breakpoints
className = "grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3";

// Or custom breakpoints from design system
className = "hidden laptop:block"; // Show on laptop and above
```

### Spacing Consistency

```jsx
// Use gap prop for Stack
<Stack gap="md">  // Translates to gap-4 (16px)

// Or Tailwind classes with our spacing tokens
className="p-6"  // 24px padding (space-6)
```

### Typography

```jsx
// Use utility classes for text hierarchy
<h1 className="typ-headline">Dashboard</h1>
<p className="typ-body">Welcome back...</p>
<span className="typ-meta">Last updated 2 hours ago</span>
```

---

## 🐛 Common Issues & Solutions

### Issue: Component not rendering

**Solution:** Check imports are from `@/Components/ui` not individual files

### Issue: Styles not applying

**Solution:** Ensure Tailwind classes are complete strings, not concatenated

### Issue: Theme not switching

**Solution:** Verify `data-theme` attribute on html/body elements

### Issue: Responsive breakpoints not working

**Solution:** Use `tablet:`, `laptop:`, `desktop:` prefixes (see tailwind.config.js)

---

## 📞 Need Help?

1. **Design Tokens:** See `/frontend/DESIGN_SYSTEM.md`
2. **Component API:** Check JSDoc comments in component files
3. **Examples:** Look at existing Navbar.jsx implementation
4. **Theming:** Review theme logic in Navbar.jsx lines 1-100

---

## ✨ Pro Tips

1. **Always use Stack for spacing** instead of manual margin/padding
2. **Prefer Button variants** over custom button styles
3. **Use Surface for elevation** rather than raw shadow classes
4. **MetricTile for KPIs**, Card for general content
5. **Container + Section** for page-level layout structure
6. **Icon wrapper** for consistent icon sizing

---

Good luck! The foundation is solid. Focus on HomePage.jsx first, then WorkspaceToolbar, then NoteCard refinements. 🚀
