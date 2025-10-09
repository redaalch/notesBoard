# 🎨 Visual Feature Guide

## Slash Commands UI

```
┌─────────────────────────────────┐
│ Type / to see commands...       │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  🔤 Heading 1              │ │ ← Hover effect
│ │  🔤 Heading 2              │ │
│ │  🔤 Heading 3              │ │
│ │  • Bullet List             │ │
│ │  1. Numbered List          │ │
│ │  ☑️ Task List               │ │
│ │  </> Code Block            │ │
│ │  " Quote                   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘

Navigation:
- ↑/↓ arrows to navigate
- Enter to select
- Esc to close
- Click to select
```

## Typing Indicator

```
When someone is typing:
┌─────────────────────────────────────┐
│ ⚫⚫⚫ John is typing...             │
└─────────────────────────────────────┘

Multiple users:
┌─────────────────────────────────────┐
│ ⚫⚫⚫ John and Sarah are typing...  │
└─────────────────────────────────────┘

Many users:
┌─────────────────────────────────────┐
│ ⚫⚫⚫ 5 people are typing...        │
└─────────────────────────────────────┘
```

## Activity Timeline

```
┌──────────────────────────────────────┐
│  Activity History                    │
│  My Project Note        [Show diffs] │
├──────────────────────────────────────┤
│                                      │
│  📝  Sarah Jones  edit  2m ago      │
│  │   Updated content section        │
│  │                                  │
│  📌  John Smith  pin  1h ago        │
│  │   Pinned note to top            │
│  │                                  │
│  🏷️  Jane Doe  tag  3h ago          │
│  │   Added "urgent" tag            │
│  │                                  │
│  ➕  John Smith  create  1d ago     │
│      Created this note              │
│                                      │
└──────────────────────────────────────┘
```

## Presence Avatars

```
Header Section:
┌────────────────────────────────────────┐
│  👤👤👤 +2  [🟢 3 live]              │
│   ↑         ↑                          │
│   Avatars   Status badge               │
└────────────────────────────────────────┘

Hover on avatar:
┌─────────────┐
│ John Smith  │ ← Tooltip
│ (You)       │
└─────────────┘
```

## Multi-Cursor View

```
Editor with multiple users:
┌─────────────────────────────────────┐
│ # Meeting Notes                     │
│                                     │
│ Topics to discuss:                  │
│ - Budget review |← John (blue)     │
│ - Q4 plans |← Sarah (purple)       │
│ - Team expansion                    │
│                                     │
└─────────────────────────────────────┘
```

## Complete Note Page Layout

```
┌─────────────────────────────────────────────────┐
│  ← NotesBoard                                   │
├─────────────────────────────────────────────────┤
│  Project Meeting Notes                  [Edit]  │
│  Board: Marketing • Last saved: Just now        │
│                                                 │
│  👤👤👤 +1    [🟢 3 live]    [Pin] [Delete]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  [Status Card]  [Stats Card]  [Tags Card]      │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Collaborative content                   │   │
│  │ ⚫⚫⚫ Sarah is typing...                 │   │
│  │                                         │   │
│  │ Type / for commands...                  │   │
│  │                                         │   │
│  │ # Meeting Notes                         │   │
│  │                                         │   │
│  │ - Budget review                         │   │
│  │ - Q4 plans                             │   │
│  │                                         │   │
│  │                     150 words • 800 chars │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [Tags: urgent, meeting, Q4]                   │
│                                                 │
│  [Activity Timeline...]                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

## User Flow Diagram

```
User Opens Note
    ↓
┌─────────────────────┐
│ WebSocket connects  │
│ Yjs Doc syncs      │
└─────────────────────┘
    ↓
┌─────────────────────┐
│ Sees other users    │
│ Presence: 👤👤👤    │
└─────────────────────┘
    ↓
User Types /
    ↓
┌─────────────────────┐
│ Popup appears       │
│ Shows commands      │
└─────────────────────┘
    ↓
User Selects H1
    ↓
┌─────────────────────┐
│ Text → Heading 1    │
│ Syncs to all users │
└─────────────────────┘
    ↓
User Keeps Typing
    ↓
┌─────────────────────┐
│ Signals typing      │
│ Others see: "⚫⚫⚫"  │
└─────────────────────┘
```

## Color Coding

### Event Colors in Timeline:

- 🔵 **Edit** - Blue (common action)
- 🟡 **Pin** - Yellow (important)
- 🟣 **Tag** - Purple (organization)
- 🟢 **Move** - Green (structure change)
- 🔴 **Delete** - Red (destructive)
- 🟢 **Create** - Emerald (new item)
- 🔵 **Title** - Indigo (metadata)
- 🟠 **Comment** - Orange (discussion)

### User Colors:

Each user gets a unique color from palette:

- Indigo (#6366F1)
- Pink (#EC4899)
- Orange (#F97316)
- Green (#10B981)
- Teal (#14B8A6)
- Purple (#8B5CF6)
- Blue (#0EA5E9)
- Amber (#F59E0B)

## Keyboard Shortcuts

```
Editor:
  Ctrl/Cmd + B     → Bold
  Ctrl/Cmd + I     → Italic
  Ctrl/Cmd + Shift + X → Strikethrough
  /                → Slash commands
  Esc              → Close popup

Slash Menu:
  ↑ ↓              → Navigate
  Enter            → Select
  Esc              → Close
```

## Responsive Behavior

### Desktop (>768px):

```
┌──────────────────────────────────────┐
│  [Full toolbar]  [All buttons]      │
│  [Wide editor]   [Sidebar visible]  │
└──────────────────────────────────────┘
```

### Mobile (<768px):

```
┌────────────────────┐
│  [Compact toolbar] │
│  [Full-width edit] │
│  [Stacked layout]  │
└────────────────────┘
```

## State Indicators

### Connection Status:

- 🟢 **Connected** - Green badge
- 🟡 **Connecting** - Yellow badge
- 🔴 **Disconnected** - Red badge

### Saving Status:

- ⏳ **Saving...** - Spinner
- ✅ **Saved** - Checkmark
- ⚠️ **Error** - Warning

## Animation Examples

### Typing Indicator:

```
Frame 1: ⚫○○
Frame 2: ○⚫○
Frame 3: ○○⚫
(Bouncing animation)
```

### Slash Menu:

```
Fade in + Slide up
Duration: 200ms
Easing: ease-out
```

### Presence Avatars:

```
New user joins:
- Scale from 0 → 1
- Fade in opacity
- Slide from right
```

---

**This is what users will experience!** ✨
