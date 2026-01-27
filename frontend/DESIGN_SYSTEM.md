# NotesBoard Design System

## Overview

This document outlines the complete design system implementation for NotesBoard, establishing a calmer, data-friendly visual language with consistent tokens, typography, and component patterns.

## Design Tokens

### Color System (2 Neutrals + 1 Accent)

#### Primary Accent - Brand Blue

```css
--color-brand-500: 75 107 251; /* Primary brand color */
```

- Used for CTAs, links, and primary actions
- Provides visual hierarchy and draws attention

#### Neutral Light - Slate

```css
--color-neutral-[50-900]  /* Gray scale for light mode */
```

- Main neutral palette for light mode
- Used for text, borders, and surfaces

#### Neutral Dark - Deep Blue-Gray

```css
--color-dark-[50-900]  /* Gray scale for dark mode */
```

- Dark mode neutral palette
- Maintains consistency with light mode hierarchy

### Spacing Scale

Based on 4px increments for predictable, harmonious layouts:

```css
--space-1: 4px    --space-6: 24px   --space-16: 64px
--space-2: 8px    --space-8: 32px   --space-20: 80px
--space-3: 12px   --space-10: 40px  --space-24: 96px
--space-4: 16px   --space-12: 48px  --space-32: 128px
--space-5: 20px
```

### Shadow System

Elevation hierarchy for depth and importance:

```css
--shadow-xs:  Subtle border replacement
--shadow-sm:  Slight lift (cards)
--shadow-md:  Default elevation (modals)
--shadow-lg:  Prominent elements
--shadow-xl:  Floating dialogs
--shadow-2xl: Maximum elevation
--shadow-glow: Brand accent glow
```

### Border Radius

Consistent corner rounding:

```css
--radius-xs: 6px    --radius-xl: 20px
--radius-sm: 8px    --radius-2xl: 24px
--radius-md: 12px   --radius-3xl: 32px
--radius-lg: 16px   --radius-full: 9999px
```

## Typography Hierarchy

### Display & Headings

- **typ-display**: Hero text, 40-64px responsive
- **typ-headline**: Page titles, 32-48px responsive
- **typ-title**: Section headings, 24-32px responsive
- **typ-subtitle**: Subsections, 18-24px responsive

### Body & Labels

- **typ-section-label**: Uppercase labels, 14px
- **typ-body**: Standard text, 16px
- **typ-body-sm**: Secondary text, 14px
- **typ-meta**: Small metadata, 12px
- **typ-caption**: Tiny uppercase, 12px

### Text Colors

- **text-primary**: Main content (highest contrast)
- **text-secondary**: Supporting content
- **text-tertiary**: De-emphasized content
- **text-quaternary**: Minimal emphasis

## Component System

### Button Variants

Located: `/frontend/src/Components/ui/Button.jsx`

**Variants:**

- `primary`: Main CTAs (blue brand)
- `secondary`: Alternative actions (neutral gray)
- `subtle`: Low-emphasis actions (minimal background)
- `critical`: Warning actions (orange/yellow)
- `destructive`: Dangerous actions (red)
- `accent`: Success actions (teal/green)
- `ghost`: Transparent background
- `outline`: Border-only style

**Sizes:** xs, sm, md, lg, xl

**Usage:**

```jsx
import { Button } from "@/Components/ui";

<Button variant="primary" size="md" icon={<PlusIcon />}>
  Create Note
</Button>;
```

### Surface Elevation

Located: `/frontend/src/Components/ui/Surface.jsx`

**Variants:**

- `base`: Flat canvas
- `raised`: Elevated cards
- `overlay`: Dialogs & modals
- `inset`: Recessed elements
- `glass`: Glassmorphic effect

### Layout Primitives

#### Stack

Flexbox layout with consistent spacing:

```jsx
<Stack direction="row" gap="md" align="center">
  {children}
</Stack>
```

#### Container

Page-width constraint with responsive padding:

```jsx
<Container size="lg" centered>
  {children}
</Container>
```

#### Section

Vertical section spacing:

```jsx
<Section spacing="lg">{children}</Section>
```

### Data Display

#### Card

Structured content container:

```jsx
<Card
  variant="raised"
  title="Analytics"
  subtitle="Last 30 days"
  actions={<Button>View Details</Button>}
>
  {content}
</Card>
```

#### MetricTile

KPI display with trend indicator:

```jsx
<MetricTile
  label="Total Notes"
  value="1,234"
  trend={{ direction: "up", label: "+12% this month" }}
  icon={<NotebookIcon />}
/>
```

#### Chip

Interactive tag with optional remove:

```jsx
<Chip tone="primary" variant="subtle" onRemove={handleRemove}>
  Project: Launch
</Chip>
```

#### Tag

Static label for categorization:

```jsx
<Tag tone="accent" icon={<CheckIcon />}>
  Published
</Tag>
```

## Theme System

### Consolidated Themes

Reduced from 10+ DaisyUI themes to **2 curated palettes**:

1. **notesLight (Daylight)**

   - Bright neutrals, calm brand accent
   - High contrast for readability
   - Optimized for daytime use

2. **notesDark (Night Shift)**
   - Dim surfaces, gentle contrast
   - Reduced eye strain
   - Focus-optimized for night work

### Theme Switching

Theme switcher in Navbar with:

- Visual preview swatches
- Clear descriptions
- Keyboard accessible
- Persists to localStorage
- Respects system preferences

## Surface Styles

### Glass Effects

Applied via utility classes:

```css
.glass-card .glass-navbar;
```

- Backdrop blur + saturation
- Subtle transparency
- Elegant, modern aesthetic

### Elevation Layers

```css
.surface-base    /* z-index: base */
/* z-index: base */
.surface-raised  /* z-index: 10 */
.surface-overlay; /* z-index: 50 */
```

## Accessibility Standards

### WCAG AA Compliance

- ✅ Minimum 4.5:1 contrast for body text
- ✅ Minimum 3:1 contrast for large text
- ✅ Focus outlines (3px solid, 2px offset)
- ✅ Touch targets minimum 44x44px
- ✅ Keyboard navigation support
- ✅ Screen reader labels (aria-\*)

### Focus Management

```css
:focus-visible {
  outline: 3px solid rgb(var(--focus-ring));
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Responsive Breakpoints

### Screen Sizes

```css
xs: 475px   /* Small phones */
tablet: 768px   /* Tablets */
laptop: 1024px  /* Laptops */
desktop: 1280px /* Desktops */
```

### Responsive Strategy

- **< 768px**: Single column, stacked layout, mobile nav
- **768px - 1024px**: Two columns, condensed spacing
- **> 1024px**: Full layout, side panels, expanded spacing

### Touch Optimization

- Minimum 44x44px touch targets
- Swipe gestures with accessible fallbacks
- Long-press selection on mobile
- Reduced motion for performance

## Implementation Phases

### ✅ Phase 1: Foundation (COMPLETED)

- [x] Design tokens in `index.css` and `tailwind.config.js`
- [x] Typography hierarchy (8 text styles)
- [x] Consolidated to 2 themes
- [x] Button component system with 8 variants
- [x] Base UI primitives (Surface, Stack, Card, Chip, Tag, Icon, Container, Section)

### 🚧 Phase 2: Dashboard (IN PROGRESS)

- [ ] Replace KPI strip with 3-card metric summary
- [ ] Notebook selector as left rail / drawer
- [ ] Sticky workspace toolbar (filters, search, views)
- [x] Update Navbar with glass effect and theme switcher

### 📋 Phase 3: Components

- [ ] Redesign NoteCard (hover toolbar, inline tags)
- [ ] Harmonize modals & drawers
- [ ] Enhanced empty states with CTAs

### 📋 Phase 4: Landing & Auth

- [ ] Hero with gradient background & carousel
- [ ] Feature sections with scannable layout
- [ ] Auth forms with feature callouts
- [ ] Responsive typography scaling

### 📋 Phase 5: Polish

- [ ] Framer Motion animations
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Update test snapshots

## File Structure

```
frontend/src/
├── index.css              # Design tokens, base styles
├── Components/
│   ├── ui/                # Design system primitives
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Chip.jsx
│   │   ├── Container.jsx
│   │   ├── Icon.jsx
│   │   ├── MetricTile.jsx
│   │   ├── Section.jsx
│   │   ├── Stack.jsx
│   │   ├── Surface.jsx
│   │   ├── Tag.jsx
│   │   └── index.js
│   ├── Navbar.jsx         # Updated with new tokens
│   └── [other components]
└── tailwind.config.js     # Tailwind customization
```

## Usage Examples

### Creating a Dashboard Section

```jsx
import {
  Container,
  Section,
  Card,
  MetricTile,
  Button,
  Stack,
} from "@/Components/ui";

function Dashboard() {
  return (
    <Section spacing="lg">
      <Container size="lg">
        <Stack direction="column" gap="lg">
          {/* Metrics Row */}
          <Stack direction="row" gap="md" wrap>
            <MetricTile
              label="Total Notes"
              value="1,234"
              trend={{ direction: "up", label: "+12%" }}
            />
            <MetricTile
              label="Notebooks"
              value="42"
              trend={{ direction: "neutral", label: "No change" }}
            />
            <MetricTile
              label="Collaborators"
              value="8"
              trend={{ direction: "up", label: "+2 new" }}
            />
          </Stack>

          {/* Content Card */}
          <Card
            variant="raised"
            title="Recent Activity"
            actions={<Button variant="subtle">View All</Button>}
          >
            {/* Card content */}
          </Card>
        </Stack>
      </Container>
    </Section>
  );
}
```

### Form with Validation

```jsx
<Stack direction="column" gap="md">
  <Button variant="primary" size="lg" fullWidth loading={isSubmitting}>
    Create Account
  </Button>

  <Button variant="secondary" size="lg" fullWidth disabled={!isValid}>
    Cancel
  </Button>
</Stack>
```

## Next Steps

1. **Dashboard Overhaul**: Implement HomePage.jsx updates with new metric cards and layout
2. **Workspace Toolbar**: Extract filter/search into reusable sticky toolbar
3. **NoteCard Redesign**: Simplify badges, add hover actions
4. **Modal Consistency**: Standardize padding and button placement
5. **Landing Page**: Redesign hero and feature sections
6. **Motion & Animation**: Add subtle entrance effects
7. **Accessibility Audit**: Verify WCAG AA across all components

## Resources

- **Design Tokens**: `/frontend/src/index.css`
- **Tailwind Config**: `/frontend/tailwind.config.js`
- **Component Library**: `/frontend/src/Components/ui/`
- **Theme Logic**: `/frontend/src/Components/Navbar.jsx`
- **Documentation**: This file (`DESIGN_SYSTEM.md`)

---

Last Updated: October 23, 2025
Version: 1.0.0
