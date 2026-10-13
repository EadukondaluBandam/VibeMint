# VibeMint Design System Foundation

> **Simple to understand. Premium to experience.**

The VibeMint design system provides a shared visual language across all applications: Mobile (iOS & Android), User Web, Creator Studio, and Admin Portal. It balances energetic social interactions with clean, trustworthy surfaces suitable for creator economies, payments, dating, and discovery.

---

## 1. Design Principles

- **Simplicity**: Clear hierarchy and obvious actions without visual clutter or noise.
- **Premium**: Refined typography, balanced spacing, and subtle elevation instead of heavy ornamentation.
- **Social & Energetic**: Vibrant mint and indigo accents that inspire creativity and expression.
- **Trustworthy**: Secure, reliable, and legible surfaces for dating, payments, wallet, safety, and moderation.
- **Cross-Platform Consistency**: Shared token foundation consumed across React web apps and Expo React Native mobile apps.
- **Accessibility by Default**: High-contrast ratios, semantic HTML, large touch targets (minimum 44x44px), screen-reader readiness, and reduced-motion consideration.

---

## 2. Color System

VibeMint avoids pure black/white extremes in favor of deep obsidian dark surfaces and crisp daylight surfaces paired with signature mint and indigo accents.

### Semantic Tokens

| Token                 | Dark Mode | Light Mode | Purpose                                      |
| :-------------------- | :-------- | :--------- | :------------------------------------------- |
| `primary`             | `#10B981` | `#059669`  | Brand accent, primary CTAs, minting/rewards  |
| `primaryForeground`   | `#022C22` | `#FFFFFF`  | Text/icons on primary surfaces               |
| `secondary`           | `#6366F1` | `#4F46E5`  | Secondary actions, social/creator highlights |
| `secondaryForeground` | `#FFFFFF` | `#FFFFFF`  | Text/icons on secondary surfaces             |
| `background`          | `#0B0F17` | `#F8FAFC`  | Base application background                  |
| `foreground`          | `#F8FAFC` | `#0F172A`  | Primary high-contrast text                   |
| `surface`             | `#111827` | `#FFFFFF`  | Card, container, and list item surface       |
| `surfaceElevated`     | `#1F2937` | `#F1F5F9`  | Modals, elevated cards, dropdowns            |
| `surfaceMuted`        | `#141D2E` | `#E2E8F0`  | Recessed areas, inactive controls            |
| `border`              | `#1E293B` | `#E2E8F0`  | Subtle structural dividers                   |
| `borderStrong`        | `#334155` | `#CBD5E1`  | Inputs, active outlines, cards               |
| `muted`               | `#1E293B` | `#F1F5F9`  | Low-priority badge/container backgrounds     |
| `mutedForeground`     | `#94A3B8` | `#64748B`  | Secondary captions, helper copy              |
| `success`             | `#22C55E` | `#16A34A`  | Completed transactions, positive status      |
| `warning`             | `#F59E0B` | `#D97706`  | Alerts, pending verifications                |
| `error`               | `#EF4444` | `#DC2626`  | Destructive actions, validation errors       |
| `info`                | `#38BDF8` | `#0284C7`  | Informational callouts, active links         |

---

## 3. Typography

Prioritizes legibility using modern system font stacks (`system-ui` on web and native system typography on mobile) with tabular numeric support.

### Hierarchy

- **Display**: `2.5rem` (40px) / Bold / `-0.02em` tracking
- **H1**: `2.0rem` (32px) / Bold / `-0.015em` tracking
- **H2**: `1.5rem` (24px) / SemiBold / `-0.01em` tracking
- **H3**: `1.25rem` (20px) / SemiBold
- **H4**: `1.125rem` (18px) / SemiBold
- **BodyLarge**: `1.125rem` (18px) / Regular / `1.75rem` line-height
- **Body**: `1.0rem` (16px) / Regular / `1.5rem` line-height
- **BodySmall**: `0.875rem` (14px) / Regular
- **Label**: `0.875rem` (14px) / Medium
- **Caption**: `0.75rem` (12px) / Regular
- **Numeric**: `1.0rem` (16px) / SemiBold / Tabular figures

### Font Weights

- **Regular**: `400`
- **Medium**: `500`
- **SemiBold**: `600`
- **Bold**: `700`

---

## 4. Spacing Scale

Based on a predictable 4px base increment:

| Key   | Rem       | Px   | Usage                                    |
| :---- | :-------- | :--- | :--------------------------------------- |
| `xs`  | `0.25rem` | 4px  | Micro-spacing, inline badges, tight gaps |
| `sm`  | `0.5rem`  | 8px  | Button inline padding, icon offsets      |
| `md`  | `0.75rem` | 12px | Standard component gap, input padding    |
| `lg`  | `1.0rem`  | 16px | Container padding, card padding          |
| `xl`  | `1.5rem`  | 24px | Section separation, screen padding       |
| `2xl` | `2.0rem`  | 32px | Major section breaks                     |
| `3xl` | `3.0rem`  | 48px | Hero/display spacing                     |
| `4xl` | `4.0rem`  | 64px | Page-level dividers                      |

---

## 5. Border Radius

Avoids exaggerated roundness while maintaining a friendly, modern touch:

- `none`: `0px`
- `sm`: `0.25rem` (4px) — Chips, badges, small controls
- `md`: `0.5rem` (8px) — Buttons, form inputs
- `lg`: `0.75rem` (12px) — Cards, dialogs, sheets
- `xl`: `1.0rem` (16px) — Elevated cards, surface overlays
- `full`: `9999px` — Avatars, pills, circular icon buttons

---

## 6. Shadows & Depth

Soft, diffused multi-layer elevation that delivers subtle depth without muddy shadows:

- `none`: Flat surfaces
- `sm`: Subtle card elevation (`0 1px 2px 0 rgba(0,0,0,0.25)`)
- `md`: Interactive cards, flyouts (`0 4px 6px -1px rgba(0,0,0,0.3)`)
- `lg`: Modals, popovers (`0 10px 15px -3px rgba(0,0,0,0.35)`)
- `xl`: Floating action buttons, spotlight overlays

---

## 7. Motion

Subtle and responsive easing curves for navigation, state changes, and interactions:

- **Duration**:
  - `instant`: `0ms` (immediate state reflection)
  - `fast`: `150ms` (button presses, micro-interactions)
  - `normal`: `250ms` (card expansions, tab transitions)
  - `slow`: `400ms` (modals, drawers, screen transitions)
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` default standard curve

---

## 8. Responsive Breakpoints

- **mobile**: `< 640px` (single column layout, bottom navigation)
- **tablet**: `768px` (dual column, compact sidebar)
- **desktop**: `1024px` (standard multi-column dashboard, sidebar expanded)
- **wide**: `1280px` (max-width canvas, optimal grid display)

---

## 9. Accessibility Principles

1. **Color Contrast**: All primary text maintains WCAG AAA (>= 7:1) and secondary text WCAG AA (>= 4.5:1).
2. **Touch Targets**: Minimum interactive dimension is 40px on web and 44px on mobile.
3. **Form Semantics**: Every input provides associated labels, `aria-invalid`, and `aria-describedby` helper/error hooks.
4. **Keyboard Accessibility**: Focus rings and tab navigation preserved across all interactive elements.

---

## 10. Foundational Components

The system provides 5 core building blocks:

- **Button**: Supports `primary`, `secondary`, `outline`, `ghost`, and `destructive` variants in `sm`, `md`, `lg` sizes with native loading and disabled states.
- **Input**: Accessible form field with label, helper text, error messaging, and disabled state styling.
- **Card**: Clean container with `default` or `elevated` surfaces and optional structural borders.
- **Avatar**: Circle avatar with automated fallback initials and `sm`, `md`, `lg` sizing.
- **Badge**: Compact status and category pill supporting `default`, `success`, `warning`, `error`, and `info`.
