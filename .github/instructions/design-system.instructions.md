---
description: "Use when working on React UI, pages, components, Tailwind styling, or UI structure."
name: "Design System"
applyTo: "client/src/components/**,client/src/pages/**"
---
# Design System

## Component library

- UI primitives: `client/src/components/ui/` — shadcn/ui (Radix + Tailwind).
- These are the canonical building blocks. Check the directory before creating custom components.
- Add new primitives via shadcn CLI (`npx shadcn@latest add <component>`) or following shadcn patterns.

## Token usage

All colors must use design tokens. Never use arbitrary hex values (`bg-[#1E3A5F]`) in production code.

### Token namespaces

| Namespace | Purpose | Example classes |
|---|---|---|
| **brand** | Brand identity colors | `bg-brand-navy`, `text-brand-gold`, `border-brand-teal` |
| **score** | 4-tier score system | `bg-score-good`, `text-score-critical`, `border-score-moderate` |
| **surface** | Background surfaces | `bg-surface-warm`, `bg-surface-cloud-a` |
| **border-soft** | Warm neutral borders | `border-border-soft` |
| **primary/accent/destructive** | shadcn semantic | `bg-primary`, `text-accent`, `border-destructive` |

### Brand tokens

| Token | Class | Hex | Usage |
|---|---|---|---|
| `--brand-navy` | `bg-brand-navy` | #1E3A5F | CTA buttons, active nav, emphasis |
| `--brand-navy-hover` | `hover:bg-brand-navy-hover` | #152C4A | Hover state for navy |
| `--brand-gold` | `text-brand-gold` | #F5C542 | Solar Points, accents, sparkles |
| `--brand-gold-dark` | `text-brand-gold-dark` | #B8941E | Gold text on light backgrounds |
| `--brand-teal` | `text-brand-teal` | #2BA4B5 | Success indicators, criteria met |

### Score tier tokens

| Token | Class | Hex | Score range |
|---|---|---|---|
| `--score-good` | `bg-score-good` | #10b981 | ≥75 |
| `--score-moderate` | `bg-score-moderate` | #f59e0b | 50–74 |
| `--score-attention` | `bg-score-attention` | #f97316 | 25–49 |
| `--score-critical` | `bg-score-critical` | #ef4444 | 0–24 |

All support alpha modifiers: `bg-score-good/20`, `from-score-critical/10`.

### Surface tokens

| Token | Hex | Usage |
|---|---|---|
| `--surface-warm` | #F8F5F0 | Page background (RH dashboard) |
| `--surface-cloud-a` | #E8EDF2 | Sky cloud layer A |
| `--surface-cloud-b` | #D5E1EA | Sky cloud layer B |

### Where raw hex is acceptable

- **Inline style props** needing hex-alpha concatenation (`${hex}E6`) — e.g., sun glow in SkyHeader/AnimatedBrandLogo palette objects.
- **Recharts** chart colors (`fill="#f87171"`) — charting library requires raw values.
- **Storybook** pages — non-production exploration files.

```tsx
// ✅ Correct — semantic Tailwind tokens
<div className="bg-card text-foreground border-border">
  <span className="text-muted-foreground">Label</span>
  <span className="text-primary">Value</span>
</div>
<Button className="bg-brand-navy hover:bg-brand-navy-hover">Save</Button>
<span className="text-score-good">Bom</span>

// ❌ Wrong — hardcoded colors
<div className="bg-[#1E3A5F]">...</div>
<span className="text-emerald-500">Bom</span>
```

## Component patterns

```tsx
// ✅ Correct — compose from shadcn/ui primitives
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ❌ Wrong — rebuild card from scratch when shadcn Card exists
<div className="rounded-lg border p-4 shadow">...</div>
```

## Page structure

Pages in `client/src/pages/` are full route components:

```tsx
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

export default function SomePage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: [...], queryFn: ... });
  // render with shadcn/ui components
}
```

## Animation

Framer Motion is available and used in pages. Use for transitions and micro-interactions. Don't over-animate data-heavy screens.

## Icons

- Primary: `lucide-react` (already bundled with shadcn/ui).
- Extended: `react-icons` for icons not in Lucide.
- Import individual icons, not entire sets.

## Rules

- Check `client/src/components/ui/` before creating a new primitive.
- Prefer semantic tokens (`bg-card`, `text-foreground`) over hardcoded palette.
- Compose from shadcn/ui primitives — don't rebuild what exists.
- Extract reusable pieces into `components/` when shared by 2+ pages.

## Anti-patterns

- Rebuilding a shadcn/ui primitive (Card, Button, Dialog) from raw HTML/CSS
- Hardcoded colors on content surfaces where semantic tokens work
- Creating a one-off component file for something used in a single place
- Importing an entire icon library when only a few icons are needed
