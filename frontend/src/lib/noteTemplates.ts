import {
  CalendarCheckIcon,
  BriefcaseIcon,
  ClipboardListIcon,
  RotateCcwIcon,
  BookHeartIcon,
  CompassIcon,
  BugIcon,
  GitPullRequestIcon,
  FileCodeIcon,
  UsersIcon,
  PenLineIcon,
  CalendarDaysIcon,
  LightbulbIcon,
  CalendarRangeIcon,
  TargetIcon,
  BookOpenIcon,
  CodeIcon,
  PaletteIcon,
  HeartIcon,
  KanbanIcon,
  type LucideIcon,
} from "lucide-react";

/* ── Types ── */

export type TemplateCategory =
  | "team-meetings"
  | "projects-planning"
  | "personal-reflection"
  | "technical"
  | "creative";

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  content: string;
  tags: string[];
  category: TemplateCategory;
  /** Lucide icon name — resolved via templateIconMap */
  icon: string;
}

/* ── Category metadata ── */

export const templateCategories: {
  id: TemplateCategory;
  label: string;
  icon: string;
}[] = [
  { id: "team-meetings", label: "Team & Meetings", icon: "Users" },
  { id: "projects-planning", label: "Projects & Planning", icon: "Kanban" },
  {
    id: "personal-reflection",
    label: "Personal & Reflection",
    icon: "Heart",
  },
  { id: "technical", label: "Technical", icon: "Code" },
  { id: "creative", label: "Creative", icon: "Palette" },
];

/* ── Icon map ── */

export const templateIconMap: Record<string, LucideIcon> = {
  CalendarCheck: CalendarCheckIcon,
  Briefcase: BriefcaseIcon,
  ClipboardList: ClipboardListIcon,
  RotateCcw: RotateCcwIcon,
  BookHeart: BookHeartIcon,
  Compass: CompassIcon,
  Bug: BugIcon,
  GitPullRequest: GitPullRequestIcon,
  FileCode: FileCodeIcon,
  Users: UsersIcon,
  PenLine: PenLineIcon,
  CalendarDays: CalendarDaysIcon,
  Lightbulb: LightbulbIcon,
  CalendarRange: CalendarRangeIcon,
  Target: TargetIcon,
  BookOpen: BookOpenIcon,
  Code: CodeIcon,
  Palette: PaletteIcon,
  Heart: HeartIcon,
  Kanban: KanbanIcon,
};

/* ── Templates ── */

export const noteTemplates: readonly NoteTemplate[] = [
  /* ─── Team & Meetings ─── */
  {
    id: "daily-standup",
    name: "Daily Stand-up",
    description: "Capture yesterday, today, and blockers at a glance.",
    category: "team-meetings",
    icon: "CalendarCheck",
    title: "Daily Stand-up Notes",
    content: `# Daily Stand-up

## Yesterday
- What I completed or made progress on…
-

## Today
- What I plan to work on today…
-

## Blockers
- Anything preventing progress (people, dependencies, unknowns)…
`,
    tags: ["standup", "team", "daily"],
  },
  {
    id: "meeting-agenda",
    name: "Meeting Agenda",
    description: "Plan discussion topics and capture decisions.",
    category: "team-meetings",
    icon: "ClipboardList",
    title: "Meeting Agenda",
    content: `# Meeting Agenda

- **Date:**
- **Attendees:**

## Topics
1. Topic and expected outcome…
2.
3.

## Decisions
- Decision made and rationale…
-

## Action Items
- Owner — Task — Due date
- Owner — Task — Due date
`,
    tags: ["meeting", "agenda"],
  },
  {
    id: "retrospective",
    name: "Retro: Start / Stop / Continue",
    description: "Reflect on wins, improvements, and next experiments.",
    category: "team-meetings",
    icon: "RotateCcw",
    title: "Sprint Retrospective",
    content: `# Sprint Retrospective

## Start
- What should we begin doing…
-

## Stop
- What is not working and should be dropped…
-

## Continue
- What is working well and should keep going…
-

## Experiments
- One small change to try next sprint…
-
`,
    tags: ["retro", "team"],
  },
  {
    id: "one-on-one",
    name: "1-on-1 Meeting",
    description: "Structure recurring check-ins with reports or managers.",
    category: "team-meetings",
    icon: "Users",
    title: "1-on-1 Notes",
    content: `# 1-on-1 Notes

- **Date:**
- **With:**

## Check-in
- How are things going overall…

## Wins This Week
- Highlight something that went well…

## Challenges
- What's been difficult or frustrating…

## Career Growth
- Skills to develop, goals to revisit…

## Action Items
- Owner — Next step — By when
-

## Notes for Next Time
- Topics to follow up on…
`,
    tags: ["1-on-1", "team", "meeting"],
  },

  /* ─── Projects & Planning ─── */
  {
    id: "project-brief",
    name: "Project Brief",
    description: "Outline goals, success metrics, and launch timeline.",
    category: "projects-planning",
    icon: "Briefcase",
    title: "Project Brief",
    content: `# Project Brief

## Overview
- What is this project and why does it matter…
- Stakeholders:

## Goals & Metrics
- Goal 1 — How we'll measure success…
- Goal 2 — Metric…

## Timeline
- Kick-off:
- Key milestone:
- Launch target:

## Risks & Mitigations
- Risk — Mitigation plan…
-
`,
    tags: ["project", "planning"],
  },
  {
    id: "product-discovery",
    name: "Product Discovery",
    description: "Map problems, hypotheses, and validation work.",
    category: "projects-planning",
    icon: "Compass",
    title: "Product Discovery Canvas",
    content: `# Product Discovery

## Customer Problem
- Who is affected and what pain do they feel…

## Hypothesis
- We believe that… will result in…

## Experiments
- How we'll test this cheaply and quickly…

## Signals to Watch
- What data or feedback will tell us we're right…

## Next Steps
- If validated:
- If invalidated:
`,
    tags: ["product", "discovery"],
  },

  /* ─── Personal & Reflection ─── */
  {
    id: "personal-journal",
    name: "Personal Journal",
    description: "Track highlights, gratitude, and tomorrow's focus.",
    category: "personal-reflection",
    icon: "BookHeart",
    title: "Daily Reflection",
    content: `# Daily Reflection

## Highlights
- Best thing that happened today…
-

## What I'm Grateful For
- Something I appreciated today…
-

## Lessons Learned
- An insight or mistake worth remembering…
-

## Tomorrow's Focus
- The one thing I must get done…
-
`,
    tags: ["journal", "reflection"],
  },
  {
    id: "weekly-review",
    name: "Weekly Review",
    description: "Reflect on the week and set priorities for the next one.",
    category: "personal-reflection",
    icon: "CalendarRange",
    title: "Weekly Review",
    content: `# Weekly Review

## Wins
- What went well this week…
-

## Challenges
- What was hard or didn't go as planned…
-

## What I Learned
- Key insight or new knowledge…
-

## Energy Check
- What gave me energy vs. what drained it…

## Next Week Priorities
1. Most important goal…
2.
3.
`,
    tags: ["review", "weekly", "reflection"],
  },
  {
    id: "goal-tracker",
    name: "Goal Tracker",
    description: "Define a goal, milestones, and track progress.",
    category: "personal-reflection",
    icon: "Target",
    title: "Goal Tracker",
    content: `# Goal Tracker

## Goal
- State the goal clearly and specifically…

## Why It Matters
- What achieving this unlocks or changes…

## Milestones
- [ ] First milestone…
- [ ] Second milestone…
- [ ] Final milestone…

## Current Progress
- Where I am right now…

## Obstacles
- What could get in the way…

## Next Action
- The very next step I can take…
`,
    tags: ["goals", "tracker"],
  },
  {
    id: "reading-notes",
    name: "Reading Notes",
    description: "Capture takeaways, quotes, and ideas from what you read.",
    category: "personal-reflection",
    icon: "BookOpen",
    title: "Reading Notes",
    content: `# Reading Notes

- **Title:**
- **Author:**

## Key Takeaways
- The main idea or argument…
-

## Favorite Quotes
> "Paste a memorable quote here…"

>

## How It Applies
- How I can use this in my work or life…

## Rating
- ★★★★☆ — Brief verdict…
`,
    tags: ["reading", "notes"],
  },

  /* ─── Technical ─── */
  {
    id: "bug-report",
    name: "Bug Report",
    description: "Document a bug with steps to reproduce and severity.",
    category: "technical",
    icon: "Bug",
    title: "Bug Report",
    content: `# Bug Report

## Summary
- One-sentence description of the issue…

## Steps to Reproduce
1. Go to…
2. Click on…
3. Observe…

## Expected Behavior
- What should happen…

## Actual Behavior
- What happens instead…

## Environment
- Browser / OS / Version:
- Account type:

## Severity
- [ ] Critical — blocks users
- [ ] Major — workaround exists
- [ ] Minor — cosmetic or edge case

## Screenshots / Logs
- Attach or paste relevant info…
`,
    tags: ["bug", "engineering"],
  },
  {
    id: "code-review",
    name: "Code Review Notes",
    description: "Structured review checklist for pull requests.",
    category: "technical",
    icon: "GitPullRequest",
    title: "Code Review Notes",
    content: `# Code Review Notes

- **PR:** (link)
- **Author:**
- **Reviewer:**

## Changes Overview
- What this PR does in plain language…

## Architecture
- Does this fit the existing patterns? Any concerns…

## Naming & Readability
- Are names clear? Is the code self-documenting…

## Performance
- Any potential bottlenecks or N+1 queries…

## Security
- Input validation, auth checks, data exposure…

## Action Items
- [ ] Must fix before merge…
- [ ] Nice to have…
`,
    tags: ["code-review", "engineering"],
  },
  {
    id: "adr",
    name: "Architecture Decision Record",
    description: "Document a technical decision with context and trade-offs.",
    category: "technical",
    icon: "FileCode",
    title: "ADR: [Decision Title]",
    content: `# ADR: [Decision Title]

- **Status:** Proposed / Accepted / Deprecated
- **Date:**
- **Author:**

## Context
- What problem or situation prompted this decision…

## Decision
- What we decided to do and why…

## Consequences
- What changes as a result (positive and negative)…

## Alternatives Considered
- Option A — Why it was rejected…
- Option B — Why it was rejected…
`,
    tags: ["adr", "architecture", "engineering"],
  },

  /* ─── Creative ─── */
  {
    id: "blog-post",
    name: "Blog Post Draft",
    description: "Structure a post from hook to call-to-action.",
    category: "creative",
    icon: "PenLine",
    title: "Blog Post Draft",
    content: `# Blog Post Draft

## Working Title
- A compelling headline that promises value…

## Hook
- Opening sentence that grabs attention…

## Key Points
1. Main argument or insight…
2. Supporting point…
3. Supporting point…

## Evidence & Examples
- Data, anecdotes, or references that back up the points…

## Call to Action
- What should the reader do after reading…

## SEO Keywords
- Primary:
- Secondary:
`,
    tags: ["blog", "writing"],
  },
  {
    id: "content-calendar",
    name: "Content Calendar",
    description: "Plan a week of content across channels.",
    category: "creative",
    icon: "CalendarDays",
    title: "Content Calendar",
    content: `# Content Calendar — Week of [Date]

## Theme
- This week's overarching topic or campaign…

## Schedule

### Monday
- Channel:
- Topic:
- Status: Draft / Scheduled / Published

### Tuesday
- Channel:
- Topic:
- Status:

### Wednesday
- Channel:
- Topic:
- Status:

### Thursday
- Channel:
- Topic:
- Status:

### Friday
- Channel:
- Topic:
- Status:

## Notes
- Cross-promotion ideas, assets needed…
`,
    tags: ["content", "calendar", "marketing"],
  },
  {
    id: "brainstorm",
    name: "Brainstorm Session",
    description: "Capture wild ideas, filter them, and pick next steps.",
    category: "creative",
    icon: "Lightbulb",
    title: "Brainstorm Session",
    content: `# Brainstorm Session

## Problem Statement
- What are we trying to solve or explore…

## Wild Ideas (no filter)
- Idea 1…
- Idea 2…
- Idea 3…

## Feasible Ideas
- Which ideas could realistically work…

## Evaluation Criteria
- Cost, effort, impact, time-to-value…

## Next Steps
- Pick 1–2 ideas to prototype or explore further…
`,
    tags: ["brainstorm", "ideation"],
  },
] as const;

/* ── Helpers ── */

export const findTemplateById = (id: string): NoteTemplate | null =>
  noteTemplates.find((template) => template.id === id) ?? null;
