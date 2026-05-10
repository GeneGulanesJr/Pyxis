---
version: "alpha"
name: "warp"
description: "A warm, restrained design system inspired by the Warp terminal — earth-toned dark surfaces, Matter typography, and editorial calmness."
colors:
  primary: "#faf9f6"              # Warm Parchment - primary text
  secondary: "#afaeac"            # Ash Gray - body text, button text
  tertiary: "#868584"             # Stone Gray - secondary labels
  neutral: "#353534"              # Earth Gray - button backgrounds, dark surfaces
  surface: "#0f0f0f"              # Deep warm near-black page background
  on-surface: "#faf9f6"           # Text on surface
  error: "#a94442"                # Error red (inferred from context)
  success: "#4caf50"              # Success green (inferred)
  warning: "#ff9800"              # Warning amber (inferred)
  border: "#e2e2e2"               # Mist Border base (rgba converted)
  border-subtle: "#1a1a1a"        # Dark border variant
  muted-text: "#868584"           # Tertiary text
  accent: "#7a6fa0"               # Purple-tint gray (link color)
---

## Overview

Warp's design is a masterclass in **warm restraint**. Unlike the cold, blue-tinted blacks of typical developer tools, Warp wraps everything in a deep, earth-toned near-black that feels like charcoal or dark soil — inviting rather than austere. The text isn't sterile white; it's **Warm Parchment** (#faf9f6), a barely-perceptible cream that softens every interaction.

The typography uses **Matter Regular** as its default voice — a geometric sans-serif with unexpected softness and humanity. Even headlines stay in weight 400; Medium (500) appears only for rare emphasis. The result is a calm, even texture that reads like a well-designed magazine, not a dashboard.

Color is nearly monochromatic — warm grays from charcoal to parchment — with no bold accents. Interactive feedback comes through opacity shifts and underlines, not chromatic drama. Photography (nature landscapes) is woven between product screenshots, creating a narrative that this terminal is for calm productivity, not hacker brutality.

This is a system built on **editorial pacing**: generous whitespace, compressed headlines, and a sense that every element was placed with intention.

## Colors

### Primary Palette

**Text Colors**
- **Primary Text** (`#faf9f6` — Warm Parchment): The dominant text color. A barely-cream off-white that eliminates the harshness of pure white while maintaining exceptional readability on dark surfaces.
- **Body Text** (`#afaeac` — Ash Gray): The workhorse reading color. Used for paragraph text, descriptions, and UI elements.
- **Secondary Text** (`#868584` — Stone Gray): Muted labels, metadata, timestamps, and de-emphasized content.

**Interactive Colors**
- **Button Background** (`#353534` — Earth Gray): Warm, dark surface for primary CTAs. Not black, not gray — a specific charcoal that feels organic.
- **Button Hover**: A subtle brightness increase (`#454545` inferred) or opacity shift, never a chromatic change.
- **Links** (`#666469` — Purple-Tint Gray): Underlined tertiary links with a faint purple undertone — the only nod to color in interactive text.

**Surface & Borders**
- **Page Background** (`#0f0f0f` — Deep Void): A warm near-black derived from Warp's body background. It's not cold (#000); it has a perceptible charcoal/gray warmth.
- **Surface Overlay** (`rgba(255, 255, 255, 0.04)` — Frosted Veil): Ultra-subtle white tint for creating surface differentiation without shadows.
- **Border Standard** (`rgba(226, 226, 226, 0.35)` — Mist Border): Semi-transparent warm gray used for card containment. At 35% opacity it creates a "ghost border" effect.
- **Border Strong** (`#353534` — Earth Gray): Solid border for prominent separations.

**Semantic Colors**
- **Success**: `#4caf50` (inferred from linear scale) — muted green for completion states
- **Warning**: `#ff9800` (inferred) — amber for caution
- **Error**: `#a94442` (inferred) — muted red for errors

**Neutral Scale**
- `#faf9f6` — Warm Parchment (highest emphasis)
- `#afaeac` — Ash Gray (high emphasis)
- `#868584` — Stone Gray (medium emphasis)
- `#666469` — Purple-Tint Gray (low emphasis, links)
- `#454545` — Dark Charcoal (secondary surface)
- `#353534` — Earth Gray (interactive surface)
- `#0f0f0f` — Deep Void (background)

### Color Usage Philosophy

Warp's palette is **intentionally limited**. The entire UI operates in a 4-5 value warm gray scale. No brand accent color exists — the only chromatic deviation is the faint purple undertone in link text. This restraint creates:
1. A unified, calm atmosphere
2. No visual competition between elements
3. Content and functionality as the focus, not decoration

Elevation is achieved through **surface brightness** (adding the Frosted Veil overlay) and **border layering**, not shadows or colored overlays.

## Typography

### Font Family

**Primary Display & Text**: `Matter Variable`, `Matter Regular` — geometric sans-serif with soft, humanist characteristics. Fallbacks: `Matter Regular Placeholder`, `-apple-system`, `BlinkMacSystemFont`, `system-ui`, `sans-serif`.

**Medium Emphasis**: `Matter Medium` — weight 500 variant for Card Titles and Buttons. Fallbacks: `Matter Medium Placeholder`.

**Squared Display**: `Matter SQ Regular` — squared variant for special display contexts (large headings in specific sections). Fallbacks: `Matter SQ Regular Placeholder`.

**UI Supplement**: `Inter` — used selectively for specific UI elements when Matter is unavailable or for specific interface text. Fallbacks: `Inter Placeholder`.

**Monospace**: `Geist Mono` (display code), `Matter Mono Regular` (body code) — Warp's custom mono companions. Fallbacks: `ui-monospace`, `SF Mono`, `Menlo`, `monospace`.

### Hierarchy

The Warp system is **remarkably flat** in its weight distribution. Nearly everything reads at Regular weight (400). Medium (500) appears in precisely three places: card titles, button text, and small caps labels. No bold (600+).

| Token Name | Font | Size | Weight | Line Height | Letter Spacing | Usage |
|------------|------|------|--------|-------------|----------------|-------|
| `headline-display` | Matter Regular | 80px | 400 | 1.00 | -2.4px | Hero headlines, maximum impact display |
| `headline-lg` | Matter Regular | 56px | 400 | 1.20 | -0.56px | Major section displays |
| `headline-md` | Matter Regular | 48px | 400 | 1.20 | -0.48px to -0.96px | Section headings, alternating weight |
| `headline-sm` | Matter Regular | 40px | 400 | 1.10 | -0.4px | Feature block titles |
| `display-alt` | Matter SQ Regular | 42px | 400 | 1.00 | 0px | Squared variant display (special contexts) |
| `subheading-lg` | Matter Regular | 36px | 400 | 1.15 | -0.72px | Large sub-section headers |
| `subheading` | Matter Regular | 32px | 400 | 1.19 | 0px | Content sub-headings |
| `body-heading` | Matter Regular | 24px | 400 | 1.20 | -0.72px to 0px | Bold content intros, section lead-ins |
| `card-title` | Matter Medium | 22px | 500 | 1.14 | 0px | Emphasized card headers, feature titles |
| `body-lg` | Matter Regular | 20px | 400 | 1.40 | -0.2px | Primary body text, introduction paragraphs |
| `body-md` | Matter Regular | 18px | 400 | 1.30 | -0.18px | Standard body paragraphs, reading text |
| `body-sm` | Matter Regular | 16px | 400 | 1.20 | 0px | Navigation links, UI text |
| `button` | Matter Medium | 16px | 500 | 1.20 | 0px | Button labels and CTAs |
| `caption` | Matter Regular | 14px | 400 | 1.00 | 1.4px | Uppercase category labels (transform: uppercase) |
| `label-sm` | Matter Regular | 12px | 400 | 1.35 | 2.4px | Uppercase micro-labels, tags (transform: uppercase) |
| `micro` | Matter Regular | 11px | 400 | 1.20 | 0px | Smallest text elements, metadata |
| `code-display` | Geist Mono | 16px | 400 | 1.00 | 0px | Terminal/code display headings |
| `code-body` | Matter Mono Regular | 16px | 400 | 1.00 | -0.2px | Code content blocks |

### Typographic Principles

1. **Regular weight dominance**: Matter Regular (400) is the default for all text, including headlines. This creates an unusually calm, even typographic texture. There is no visual shouting.

2. **Ceremonial uppercase**: Small labels and categories use `text-transform: uppercase` with wide letter-spacing (1.4px at 14px, 2.4px at 12px). This creates an editorial, magazine-like categorization system that feels considered rather than mechanical.

3. **Negative tracking at scale**: Display sizes (56px+, up to 80px) receive progressively tighter letter-spacing: -2.4px at 80px, -0.56px at 56px, -0.48px at 48px. Below 40px spacing returns to normal (0 or slightly negative). This compression adds sophistication without sacrificing legibility.

4. **Warm legibility**: The combination of Matter's geometric softness + the warm parchment text color (#faf9f6) + the charcoal-dark background creates a reading experience that feels human, not clinical.

5. **Three-tier structure**: The system is remarkably flat. 400 (read), 500 (emphasize), no bold. No heavy weights exist. This restraint is a philosophical choice — the design communicates confidence through simplicity.

## Layout

### Spacing System

**Base Unit**: 8px
**Scale**: 1px, 4px, 5px, 8px, 10px, 12px, 14px, 15px, 16px, 18px, 24px, 26px, 30px, 32px, 36px

The scale includes micro-adjustments like 5px, 10px, 14px, 15px, 26px — optical tuning rather than mathematical progression. The 7px common in Linear's system is absent; Warp uses cleaner round numbers and 5px for subtle micro-gaps.

**Spacing Tokens** (for DESIGN.md component reference):
- `spacing-xs`: 4px
- `spacing-sm`: 8px
- `spacing-md`: 16px
- `spacing-lg`: 24px
- `spacing-xl`: 32px
- `spacing-2xl`: 48px
- `spacing-3xl`: 80px
- `spacing-4xl`: 120px

### Container & Grid

**Max Width**: ~1500px container width (breakpoint at 1500px). Content is centered with generous side margins on ultra-wide screens.

**Breakpoints (inferred)**:
- **Mobile**: < 810px — single column, hero text reduces to 48px, navigation collapses
- **Tablet**: 810px–1024px — 2-column features begin, photography scales
- **Desktop**: 1024px–1500px — standard multi-column layouts, photography + text side-by-side
- **Large Desktop**: >1500px — full cinematic layout with 80px hero display, generous margins

**Grid Patterns**:
- **Hero**: Centered single-column, vertical spacing 80–120px
- **Feature sections**: 2-column (text left, photography right, or swapped)
- **Testimonials**: Single-column centered text
- **Cards**: 2–3 column grids depending on viewport width

### Whitespace Philosophy

Warp's spacing is **generous to the point of serenity**. Section padding ranges from 80px to 120px — these are not "SaaS cramped" margins. The dark canvas creates a warm void that feels contemplative. Photography is used as visual breathing room between dense information blocks.

The layout pacing feels **editorial, like a magazine**: each section is a page-turn moment. No border dividers separate sections — the background color provides natural isolation. This creates a calm rhythm: text → image → text → image, each with space to breathe.

## Elevation & Depth

### Depth Levels

| Level | Treatment | Usage |
|-------|-----------|-------|
| **0 — Flat** | No shadow, `#0f0f0f` bg | Page base, most surfaces |
| **1 — Veil** | `rgba(255,255,255,0.04)` overlay | Subtle surface lift for cards |
| **2 — Border** | `rgba(226,226,226,0.35) 1px` border | Card containment, dividers |
| **3 — Ambient** | Inferred `rgba(0,0,0,0.2) 0px 5px 15px` | Floating elements, images |

### Depth Philosophy

Warp avoids **drop shadows almost entirely**. On dark surfaces, traditional shadows are either invisible or look gratuitous. Instead, depth is communicated through:

1. **Semi-transparent borders**: The Mist Border (`rgba(226,226,226,0.35)`) creates a faint, ghostly outline that suggests containment without a hard edge.
2. **Surface opacity stacking**: Cards use `rgba(255,255,255,0.02)` to `rgba(255,255,255,0.04)` overlays to differentiate layers.
3. **Photography as depth**: Nature landscapes provide atmospheric perspective that CSS cannot.
4. **No glassmorphism**: Blur effects are absent. The aesthetic is solid, grounded, tactile.

Elevation is **not about floating**. Everything feels anchored, resting on the dark canvas. The whisper-thin borders give just enough separation to distinguish elements without creating hierarchy drama.

## Shapes

### Border Radius Scale

Warp uses a simple, restrained radius vocabulary:

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Small interactive elements, tags, inline buttons |
| `radius-md` | 8px | Images, video containers, standard cards |
| `radius-lg` | 12px | Feature cards, large containers |
| `radius-xl` | 14px | Prominent containers, oversized cards |
| `radius-pill` | 50px | Primary CTA buttons, pill badges |
| `radius-full` | 9999px | Progress bars, fully rounded pills |

**Notable**: The **50px pill radius** is signature. Primary buttons and status indicators use this full-pill shape, creating a soft, friendly CTA that's unmistakably Warp.

### Shape Language

- **Pill dominance**: The 50px pill button is the primary interactive shape — warm, organic, inviting.
- **Modest rounding**: Cards and images use 8–12px — enough to soften edges but not bubble-like.
- **No sharp corners**: Everything is rounded minimum 4px. Even small tags avoid 0px.
- **Squaring alternate**: Matter SQ (squared variant) exists but is used sparingly as a typographic alternate, not a shape system.

The shape philosophy: **approachable softness**. Even buttons feel friendly. No ultra-sharp corners, no aggressive geometries.

## Components

### Buttons

**1. Primary Button — Dark Pill**
```css
background: {colors.neutral}      /* #353534 Earth Gray */
color: {colors.secondary}         /* #afaeac Ash Gray */
border-radius: 50px                /* Pill shape */
padding: 10px 24px                 /* Generous horizontal, modest vertical */
font: {typography.button}
```
The main CTA. Warm, muted, understated. No border. Hover: brightness increase to `#454545`.

**2. Secondary Button — Ghost + Underline**
```css
background: transparent
color: {colors.primary}            /* #faf9f6 */
border: none
text-decoration: underline        /* Appears on hover or persistently */
```
For secondary actions. May appear with a subtle border or just hover underline.

**3. Small Tag — Frosted**
```css
background: rgba(255,255,255,0.16)
color: #000000                     /* Black text on frosted light */
border-radius: 6px
padding: 1px 6px
font-size: 12px
```
For categories, version tags. White-tinted glass effect with dark text.

### Cards

**Content Card**
```css
background: rgba(255,255,255,0.02)   /* Near-transparent */
border: 1px solid rgba(226,226,226,0.35)  /* Mist Border */
border-radius: 12px
padding: 24px
```
For feature descriptions and text-heavy content. The subtle border provides containment without visual weight.

**Image Card**
```css
border-radius: 12px
overflow: hidden
border: none
```
Full-bleed imagery (nature photos, terminal screenshots). No border; edges are pure image.

**Elevated Card** (hover)
- On hover, cards may receive the `Frosted Veil` (`rgba(255,255,255,0.04)`) overlay, barely perceptible.

### Navigation

**Top Navigation Bar**
```css
position: sticky
top: 0
background: {colors.surface}         /* #0f0f0f */
border-bottom: 1px solid rgba(226,226,226,0.1)  /* Very subtle */
padding: 0 24px
height: 64px
```
- **Brand**: Warm Parchment text, Matter Medium weight
- **Links**: Stone Gray (`#868584`), Matter Regular 16px, 1.20 line-height
- **Active/Hover**: Warm Parchment (`#faf9f6`)
- **Right-aligned**: Dark Pill primary button
- **Mobile**: Hamburger menu, simplified

### Form Inputs

Warp's marketing site uses minimal forms, but the style is:
```css
background: rgba(255,255,255,0.04)
border: 1px solid rgba(226,226,226,0.3)
border-radius: 8px
color: {colors.secondary}
padding: 12px 16px
```
Focus: border brightens to `rgba(226,226,226,0.6)`, no colored rings.

### Typography Components

**Category Label**
```css
font: Matter Regular 12px
text-transform: uppercase
letter-spacing: 2.4px
color: {colors.tertiary}
```
Editorial magazine-style categorization.

**Code Block**
```css
font: Geist Mono 16px / 1.00
background: #0f0f0f
border: 1px solid rgba(226,226,226,0.2)
border-radius: 8px
padding: 16px
color: {colors.secondary}
```

### Badges & Pills

**Status Pill**
```css
background: {colors.neutral}       /* #353534 */
color: {colors.secondary}          /* #afaeac */
border-radius: 9999px
padding: 4px 12px
font-size: 12px
font-weight: 500
```
For status indicators and tags.

**Subtle Badge**
```css
background: rgba(255,255,255,0.05)
color: {colors.primary}
border: 1px solid rgba(226,226,226,0.2)
border-radius: 2px
padding: 2px 6px
font-size: 11px
```
For version numbers, small labels.

## Do's and Don'ts

### Do's

**Typography**
- ✅ Use Matter Regular (weight 400) for ALL text by default — even headlines. Reserve Medium (500) for card titles and buttons only.
- ✅ Apply negative letter-spacing to display headings: -2.4px at 80px, -0.56px at 56px, -0.4px at 40px. This is non-negotiable for the Warp headline aesthetic.
- ✅ Use uppercase transformation with wide letter-spacing (1.4px at 14px, 2.4px at 12px) for category labels and micro-labels.
- ✅ Maintain tight line-heights: 1.00–1.20 for headlines, 1.30–1.40 for body. Never exceed 1.40.
- ✅ Include matter of content on dark backgrounds — it's designed for this contrast.

**Color & Surfaces**
- ✅ Use Warm Parchment (`#faf9f6`) for all text, never pure white. The cream undertone is essential to the warmth.
- ✅ Keep button backgrounds muted: Earth Gray (`#353534`) only. Never use brand colors for CTAs.
- ✅ Use semi-transparent borders (`rgba(226,226,226,0.35)`) for card containment. Let the borders whisper, not shout.
- ✅ Apply the Frosted Veil overlay (`rgba(255,255,255,0.04)`) sparingly to differentiate surface levels.
- ✅ Let nature photography breathe — use full-bleed images with generous spacing.
- ✅ Maintain the warm, almost monochromatic palette. No blue, no neon, no saturation beyond the existing grays.

**Layout & Composition**
- ✅ Use generous section spacing: 80–120px vertical between major sections.
- ✅ Interleave photography and product screenshots. This isn't decoration; it's brand narrative.
- ✅ Keep shapes soft: 8–12px for cards, 50px for pill buttons.
- ✅ Design with editorial calm — each section should feel like a magazine page.

**Interactions**
- ✅ Use opacity or brightness shifts for hover states. No color changes.
- ✅ Keep animations minimal and slow (0.3–0.4s ease-out). Nothing bouncy.
- ✅ Let content be the交互 — the UI should recede, not animate for attention.

### Don'ts

**Typography**
- ❌ DON'T use pure white (`#ffffff`) for text. Always `#faf9f6`.
- ❌ DON'T apply weight 600+ (Semibold, Bold). Warp's max is Medium (500) for emphasis.
- ❌ DON'T use tight letter-spacing on body text. Only display headings get compression.
- ❌ DON'T mix in other fonts. Stick to Matter family + Inter supplement.

**Color**
- ❌ DON'T introduce accent colors (blue, green, pink, orange). The system is deliberately monochromatic warm gray.
- ❌ DON'T use cold or blue-tinted blacks. Backgrounds must feel warm/charcoal.
- ❌ DON'T add gradients or glow effects. The only visual interest is photography.
- ❌ DON'T make buttons bright or saturated. Earth Gray only.

**Layout & Depth**
- ❌ DON'T use heavy drop shadows. Depth comes from borders and surface opacity, not shadow.
- ❌ DON'T cramp spacing. 80+px section padding is normal, not excessive.
- ❌ DON'T use sharp corners (0px radius). Minimum 4px everywhere.
- ❌ DON'T create visual competition between elements. Let hierarchy emerge from size, not color.

**Components**
- ❌ DON'T use ghost buttons with colored borders. Ghost = underline or nothing.
- ❌ DON'T add decorative UI chrome. The design is product-first, minimal chrome.
- ❌ DON'T overuse borders. A card needs at most one border; sections need none.

**General**
- ❌ DON'T make it look like a typical SaaS template. This is a terminal company with a lifestyle brand soul.
