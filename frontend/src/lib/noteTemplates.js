export const noteTemplates = [
  {
    id: "daily-standup",
    name: "Daily Stand-up",
    description: "Capture yesterday, today, and blockers at a glance.",
    title: "Daily Stand-up Notes",
    content: `# Daily Stand-up

## Yesterday
- 
- 

## Today
- 
- 

## Blockers
- 
`,
    tags: ["standup", "team", "daily"],
  },
  {
    id: "project-brief",
    name: "Project Brief",
    description: "Outline goals, success metrics, and launch timeline.",
    title: "Project Brief",
    content: `# Project Brief

## Overview
- Summary:
- Stakeholders:

## Goals & Metrics
- Goal 1 — Metric:
- Goal 2 — Metric:

## Timeline
- Kick-off:
- Launch target:

## Risks & Mitigations
- Risk:
- Plan:
`,
    tags: ["project", "planning"],
  },
  {
    id: "meeting-agenda",
    name: "Meeting Agenda",
    description: "Plan discussion topics and capture decisions.",
    title: "Meeting Agenda",
    content: `# Meeting Agenda

- Date:
- Attendees:

## Topics
1. 
2. 
3. 

## Decisions
- 
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
    title: "Sprint Retrospective",
    content: `# Sprint Retrospective

## Start
- 
- 

## Stop
- 
- 

## Continue
- 
- 

## Experiments
- 
- 
`,
    tags: ["retro", "team"],
  },
  {
    id: "personal-journal",
    name: "Personal Journal",
    description: "Track highlights, gratitude, and tomorrow's focus.",
    title: "Daily Reflection",
    content: `# Daily Reflection

## Highlights
- 
- 

## What I'm grateful for
- 
- 

## Lessons learned
- 
- 

## Tomorrow's focus
- 
- 
`,
    tags: ["journal", "reflection"],
  },
  {
    id: "product-discovery",
    name: "Product Discovery",
    description: "Map problems, hypotheses, and validation work.",
    title: "Product Discovery Canvas",
    content: `# Product Discovery

## Customer Problem
- 

## Hypothesis
- We believe that ...

## Experiments
- 

## Signals to Watch
- 

## Next Steps
- 
- 
`,
    tags: ["product", "discovery"],
  },
];

export const findTemplateById = (id) =>
  noteTemplates.find((template) => template.id === id) ?? null;
