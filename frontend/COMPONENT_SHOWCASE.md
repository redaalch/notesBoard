# Component Showcase - Visual Reference

## Button Variants

### Primary Actions

```jsx
<Button variant="primary">Save Changes</Button>
<Button variant="primary" icon={<PlusIcon />}>Create Note</Button>
<Button variant="primary" loading>Processing...</Button>
```

🎨 **Style:** Blue brand, high emphasis, solid background
📍 **Use for:** Main CTAs, form submissions, primary actions

### Secondary Actions

```jsx
<Button variant="secondary">Cancel</Button>
<Button variant="secondary" icon={<FilterIcon />}>Filter</Button>
```

🎨 **Style:** Neutral gray, bordered, subtle elevation
📍 **Use for:** Alternative actions, form cancellations

### Subtle Actions

```jsx
<Button variant="subtle">Learn More</Button>
<Button variant="subtle" icon={<ChevronDownIcon />}>Expand</Button>
```

🎨 **Style:** Transparent, minimal hover state
📍 **Use for:** Tertiary actions, expandable sections

### Critical Actions

```jsx
<Button variant="critical">Warning Action</Button>
<Button variant="critical" icon={<AlertTriangleIcon />}>Review Required</Button>
```

🎨 **Style:** Orange/Yellow, attention-grabbing
📍 **Use for:** Important warnings, actions requiring attention

### Destructive Actions

```jsx
<Button variant="destructive">Delete Forever</Button>
<Button variant="destructive" icon={<Trash2Icon />}>Remove Account</Button>
```

🎨 **Style:** Red, danger indication
📍 **Use for:** Permanent deletions, destructive operations

### Accent Actions

```jsx
<Button variant="accent">Publish Now</Button>
<Button variant="accent" icon={<CheckIcon />}>Mark Complete</Button>
```

🎨 **Style:** Teal/Green, success indication
📍 **Use for:** Positive confirmations, completions

### Ghost Actions

```jsx
<Button variant="ghost" icon={<SettingsIcon />} />
<Button variant="ghost">View Details</Button>
```

🎨 **Style:** Fully transparent, icon-friendly
📍 **Use for:** Icon buttons, minimal emphasis actions

### Outline Actions

```jsx
<Button variant="outline">Select Option</Button>
<Button variant="outline" icon={<ExternalLinkIcon />}>Open External</Button>
```

🎨 **Style:** Border-only, high contrast
📍 **Use for:** Selection states, external links

---

## Button Sizes

```jsx
<Button size="xs">Tiny</Button>        // 32px height
<Button size="sm">Small</Button>       // 36px height
<Button size="md">Medium</Button>      // 40px height (default)
<Button size="lg">Large</Button>       // 48px height
<Button size="xl">Extra Large</Button> // 56px height
```

---

## Surface Variants

### Base Surface

```jsx
<Surface variant="base" padding="md">
  Content on base canvas
</Surface>
```

🎨 **Elevation:** z-0, minimal shadow
📍 **Use for:** Base containers, form backgrounds

### Raised Surface

```jsx
<Surface variant="raised" padding="lg">
  Elevated card content
</Surface>
```

🎨 **Elevation:** z-10, soft shadow
📍 **Use for:** Cards, panels, grouped content

### Overlay Surface

```jsx
<Surface variant="overlay" padding="xl">
  Modal or dialog content
</Surface>
```

🎨 **Elevation:** z-50, strong shadow, backdrop blur
📍 **Use for:** Modals, dialogs, popovers

### Inset Surface

```jsx
<Surface variant="inset" padding="sm">
  Recessed input area
</Surface>
```

🎨 **Elevation:** Inverted, inner shadow
📍 **Use for:** Input wells, recessed sections

### Glass Surface

```jsx
<Surface variant="glass" padding="md">
  Translucent glassmorphic card
</Surface>
```

🎨 **Elevation:** Backdrop blur, semi-transparent
📍 **Use for:** Floating panels, overlays, modern aesthetic

---

## Typography Hierarchy

### Display (Hero Text)

```jsx
<h1 className="typ-display">Welcome to NotesBoard</h1>
```

📏 **Size:** 40-64px (responsive)
📍 **Use for:** Landing page heroes, major announcements

### Headline (Page Titles)

```jsx
<h1 className="typ-headline">Dashboard Overview</h1>
```

📏 **Size:** 32-48px (responsive)
📍 **Use for:** Page titles, major section headers

### Title (Section Headers)

```jsx
<h2 className="typ-title">Recent Activity</h2>
```

📏 **Size:** 24-32px (responsive)
📍 **Use for:** Section headings, card titles

### Subtitle (Subsections)

```jsx
<h3 className="typ-subtitle">Quick Actions</h3>
```

📏 **Size:** 18-24px (responsive)
📍 **Use for:** Subsection headers, grouped content

### Section Label (Eyebrows)

```jsx
<span className="typ-section-label">Dashboard</span>
```

📏 **Size:** 14px (uppercase, tracked)
📍 **Use for:** Eyebrow labels, category tags

### Body (Standard Text)

```jsx
<p className="typ-body">This is standard body text for reading content.</p>
```

📏 **Size:** 16px
📍 **Use for:** Main content, descriptions

### Body Small (Supporting Text)

```jsx
<p className="typ-body-sm">Additional details and supporting information.</p>
```

📏 **Size:** 14px
📍 **Use for:** Secondary descriptions, help text

### Meta (Tiny Text)

```jsx
<span className="typ-meta">Updated 2 hours ago</span>
```

📏 **Size:** 12px
📍 **Use for:** Timestamps, metadata, footnotes

### Caption (Labels)

```jsx
<span className="typ-caption">Featured</span>
```

📏 **Size:** 12px (uppercase, tracked)
📍 **Use for:** Badges, status labels, tiny headers

---

## Layout Primitives

### Stack (Flexbox Layout)

```jsx
// Vertical stack with medium gap
<Stack direction="column" gap="md">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Stack>

// Horizontal stack with space-between
<Stack direction="row" justify="between" align="center">
  <span>Left</span>
  <span>Right</span>
</Stack>

// Responsive grid
<Stack
  direction="row"
  gap="lg"
  wrap
  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
>
  <Card>Card 1</Card>
  <Card>Card 2</Card>
  <Card>Card 3</Card>
</Stack>
```

**Props:**

- `direction`: "row" | "column"
- `gap`: "none" | "xs" | "sm" | "md" | "lg" | "xl"
- `align`: "start" | "center" | "end" | "stretch" | "baseline"
- `justify`: "start" | "center" | "end" | "between" | "around" | "evenly"
- `wrap`: boolean
- `inline`: boolean

---

### Container (Width Constraint)

```jsx
// Large container (default)
<Container size="lg">
  Page content constrained to 1280px
</Container>

// Full width container
<Container size="full" gutters={false}>
  Edge-to-edge content
</Container>
```

**Props:**

- `size`: "sm" | "md" | "lg" | "xl" | "full"
- `centered`: boolean (default: true)
- `gutters`: boolean (default: true) - adds horizontal padding

---

### Section (Vertical Spacing)

```jsx
// Medium vertical spacing
<Section spacing="md">
  Section content with consistent vertical rhythm
</Section>

// Large spacing for major sections
<Section spacing="lg">
  Hero or major landing section
</Section>
```

**Props:**

- `spacing`: "none" | "sm" | "md" | "lg" | "xl"

---

## Card Variations

### Basic Card

```jsx
<Card variant="raised" padding="md">
  <p>Simple card content</p>
</Card>
```

### Card with Header

```jsx
<Card
  variant="raised"
  title="Analytics Summary"
  subtitle="Last 30 days of activity"
  eyebrow="Dashboard"
>
  <p>Card content goes here</p>
</Card>
```

### Card with Actions

```jsx
<Card
  title="Team Members"
  actions={
    <>
      <Button variant="subtle" size="sm">
        Manage
      </Button>
      <Button variant="primary" size="sm">
        Invite
      </Button>
    </>
  }
>
  <ul>Member list...</ul>
</Card>
```

### Card with Footer

```jsx
<Card
  title="Project Status"
  footer={
    <Stack direction="row" justify="between">
      <span className="typ-meta">Last updated 2h ago</span>
      <a href="#" className="text-brand-600">
        View details →
      </a>
    </Stack>
  }
>
  <p>Project details...</p>
</Card>
```

---

## Metric Tiles

### Basic Metric

```jsx
<MetricTile label="Total Notes" value="1,234" />
```

### Metric with Trend

```jsx
<MetricTile
  label="Active Users"
  value="842"
  sublabel="Last 7 days"
  trend={{
    direction: "up",
    label: "+12% vs last week",
  }}
/>
```

### Metric with Icon

```jsx
<MetricTile
  label="Revenue"
  value="$24,500"
  sublabel="This month"
  icon={<DollarSignIcon className="size-5" />}
  trend={{
    direction: "up",
    label: "+8%",
    tone: "positive",
  }}
/>
```

**Trend Options:**

- `direction`: "up" | "down" | "neutral"
- `tone`: "positive" | "negative" | "neutral" (auto-detected if not set)
- `label`: string (displayed text)

---

## Chips & Tags

### Chip Variants

```jsx
<Chip tone="neutral" variant="subtle">Neutral</Chip>
<Chip tone="primary" variant="solid">Primary</Chip>
<Chip tone="success" variant="outline">Success</Chip>
<Chip tone="warning" variant="subtle">Warning</Chip>
<Chip tone="danger" variant="solid">Danger</Chip>
```

### Chip with Icon

```jsx
<Chip tone="primary" icon={<UserIcon />}>
  John Doe
</Chip>
```

### Removable Chip

```jsx
<Chip
  tone="accent"
  onRemove={() => handleRemove("tag-id")}
  removeLabel="Remove tag"
>
  Project Alpha
</Chip>
```

### Tag Variants

```jsx
<Tag tone="primary">Featured</Tag>
<Tag tone="accent" icon={<CheckIcon />}>Published</Tag>
<Tag tone="warning" variant="outline">Draft</Tag>
```

---

## Icon Wrapper

### Consistent Icon Sizing

```jsx
<Icon size="xs"><PlusIcon /></Icon>    // 14px
<Icon size="sm"><PlusIcon /></Icon>    // 16px
<Icon size="md"><PlusIcon /></Icon>    // 20px (default)
<Icon size="lg"><PlusIcon /></Icon>    // 24px
<Icon size="xl"><PlusIcon /></Icon>    // 32px
```

### In Context

```jsx
<Button icon={<Icon size="sm"><PlusIcon /></Icon>}>
  Create
</Button>

<Card
  icon={<Icon size="lg"><NotebookIcon /></Icon>}
  title="Notebooks"
>
  Content
</Card>
```

---

## Color Utilities

### Text Colors

```jsx
<p className="text-primary">Highest emphasis text</p>
<p className="text-secondary">Supporting text</p>
<p className="text-tertiary">De-emphasized text</p>
<p className="text-quaternary">Minimal emphasis</p>

// Legacy aliases (still supported)
<p className="text-muted">Muted text (same as secondary)</p>
<p className="text-subtle">Subtle text (same as tertiary)</p>
```

---

## Complete Page Example

```jsx
import {
  Container,
  Section,
  Stack,
  Card,
  MetricTile,
  Button,
  Chip,
} from "@/Components/ui";
import {
  NotebookIcon,
  UsersIcon,
  TrendingUpIcon,
  PlusIcon,
} from "lucide-react";

function DashboardPage() {
  return (
    <>
      {/* Hero Section */}
      <Section spacing="lg">
        <Container size="lg">
          <Stack direction="column" gap="md" align="center">
            <h1 className="typ-display text-center">Welcome back, Alex</h1>
            <p className="typ-body text-center text-secondary max-w-2xl">
              You have 3 new notifications and 12 notes waiting for review.
            </p>
            <Stack direction="row" gap="md">
              <Button variant="primary" size="lg" icon={<PlusIcon />}>
                Create Note
              </Button>
              <Button variant="secondary" size="lg">
                View All Notes
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Section>

      {/* Metrics Section */}
      <Section spacing="md">
        <Container size="lg">
          <Stack
            direction="row"
            gap="md"
            wrap
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <MetricTile
              label="Total Notes"
              value="1,234"
              sublabel="Across all notebooks"
              trend={{ direction: "up", label: "+12%" }}
              icon={<NotebookIcon className="size-5" />}
            />
            <MetricTile
              label="Collaborators"
              value="42"
              sublabel="Active this week"
              trend={{ direction: "neutral", label: "No change" }}
              icon={<UsersIcon className="size-5" />}
            />
            <MetricTile
              label="Engagement"
              value="89%"
              sublabel="Team participation"
              trend={{ direction: "up", label: "+5%" }}
              icon={<TrendingUpIcon className="size-5" />}
            />
          </Stack>
        </Container>
      </Section>

      {/* Content Section */}
      <Section spacing="md">
        <Container size="lg">
          <Stack direction="column" gap="lg">
            <Card
              variant="raised"
              title="Recent Activity"
              subtitle="Your latest updates and changes"
              eyebrow="Dashboard"
              actions={
                <Button variant="subtle" size="sm">
                  View All
                </Button>
              }
            >
              <Stack direction="column" gap="md">
                {/* Activity items */}
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50">
                  <div className="size-2 rounded-full bg-brand-600" />
                  <p className="typ-body flex-1">Note updated: Q4 Planning</p>
                  <span className="typ-meta">2h ago</span>
                </div>
                {/* More activity items... */}
              </Stack>
            </Card>

            <Card
              variant="raised"
              title="Active Tags"
              footer="Click a tag to filter notes"
            >
              <Stack direction="row" gap="xs" wrap>
                <Chip tone="primary" variant="subtle">
                  Design
                </Chip>
                <Chip tone="accent" variant="subtle">
                  Development
                </Chip>
                <Chip tone="warning" variant="subtle">
                  Marketing
                </Chip>
                <Chip tone="neutral" variant="subtle">
                  Research
                </Chip>
              </Stack>
            </Card>
          </Stack>
        </Container>
      </Section>
    </>
  );
}
```

---

## Accessibility Checklist

✅ **Buttons:**

- Use semantic `<button>` elements
- Provide clear labels or `aria-label`
- Ensure 44x44px minimum touch target
- Loading state with `aria-busy`
- Disabled state with `aria-disabled`

✅ **Forms:**

- Associate labels with inputs
- Provide error messages
- Indicate required fields
- Use proper input types

✅ **Interactive Elements:**

- Keyboard navigable (Tab, Enter, Space)
- Visible focus indicators
- Screen reader friendly labels
- ARIA roles and states

✅ **Color Contrast:**

- Text ≥ 4.5:1 contrast ratio
- Large text ≥ 3:1 contrast ratio
- Interactive elements ≥ 3:1

✅ **Motion:**

- Respect `prefers-reduced-motion`
- Provide static alternatives
- Keep animations subtle and purposeful

---

Last Updated: October 23, 2025
