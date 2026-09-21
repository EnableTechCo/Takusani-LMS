# Takusani LMS Design System

| Document | UI-LMS-001 |
|---|---|
| Version | 0.2 (for review) |
| Date | 21 September 2026 |
| Owner | UI Designer (visual language, tokens, components). Structure and behaviour are owned by `LMS-ux-architecture.md` (UX-LMS-001). |
| Inputs | SRS-LMS-001 sections 1, 2, 4.3, 4.4, 4.9, 5.3; `LMS-data-model.md` state models; `LMS-ux-architecture.md` sections 3, 5.2, 7, 8, 9, 10; the `minimalist-ui` direction chosen by the product owner |
| Working files | `prototype/assets/tokens.css`, `prototype/assets/ui.css`, `prototype/assets/ui.js`, `prototype/assets/mark.svg`, `prototype/assets/logo.svg`, `prototype/components.html` |

**Precedence.** Where this document and the UX architecture disagree on structure, tones, breakpoints, wording or states, the UX architecture wins and this document is corrected. Where taste and accessibility disagree, accessibility wins (WCAG 2.2 AA).

**How to read contrast figures.** Every ratio in this document was computed with the WCAG relative-luminance formula (a Node script during authoring) and is recomputed live in `components.html` from the token values, in both themes. Body text needs 4.5:1. Control boundaries, tag borders, focus rings and chart marks need 3:1.

---

## 1. Brand proposal

### 1.1 What Takusani should feel like

This system decides whether people gain a qualification. It holds results back while a second person checks them, it starts short legal clocks the moment a result is released, and it records who decided what. The brand therefore has one job: to make a high-stakes process feel **trustworthy, calm and fair**.

| Quality | What it means on screen |
|---|---|
| Trustworthy | Nothing decorative competes with the record. References, times and names are set plainly, in monospace where they must be compared or read out. The interface never says "Saved" when it means "on this device". |
| Calm | A warm paper-coloured canvas, off-black text, flat surfaces with a 1px hairline, no gradients, no shadows, no celebration effects, motion only on state changes. Density is comfortable, not sparse: this is a working tool. |
| Fair | Both outcomes are professional judgements. "Competent" is positive and quiet. "Not yet competent" is amber "action needed" and is always followed by the next step and its date. It is never red, never a cross, never "failed". |

The institution is the authority the learner deals with, so the institution's name (in the examples, Khanya Skills Institute) always sits beside the product name, and leads on the sign-in page. Takusani is the instrument, not the institution.

Open point for the product owner: if "Takusani" carries a meaning in a South African language that the client intends, confirm it before the brand is finalised. Nothing in this proposal depends on a meaning.

### 1.2 Mark

A rounded tile carrying a knocked-out capital **T** whose crossbar has two equal weights hanging beneath it: a level balance. It says "T", and it says "equal treatment", without drawing scales of justice.

Construction on a 32 × 32 grid, one even-odd path, `currentColor` only (it inherits the text colour and works on any surface and in both themes):

| Part | Geometry |
|---|---|
| Tile | 32 × 32, corner radius 7 |
| Crossbar (knocked out) | x 7 to 25, y 8.5 to 12 (18 × 3.5) |
| Stem (knocked out) | x 14.25 to 17.75, y 12 to 24 (3.5 × 12), centred |
| Two weights (knocked out) | circles r 1.75 at (10, 17.5) and (22, 17.5): equal size, equal height, symmetrical about the stem |
| Clear space | 25% of the tile width on every side |
| Minimum size | 16px (favicon). Below 20px the weights still read as two dots; do not simplify further. |

File: `prototype/assets/mark.svg`. Never recolour parts of it, never place it on a photograph, never add a shadow or outline.

### 1.3 Wordmark

"Takusani" in **Newsreader Medium (500)**, sentence case, tracking −0.02em, optically aligned to the tile's vertical centre, followed by "LMS" in **Geist Mono Medium**, 0.6875rem, uppercase, tracking 0.08em, at 72% opacity, baseline-aligned. The serif gives the name an editorial, institutional voice; the mono suffix says "system of record".

- In the application, build the lockup in HTML with `.brand` (inline mark + `.brand__name` + `.brand__suffix`) so that it uses the loaded font and scales with text.
- `prototype/assets/logo.svg` uses live `<text>` so it stays editable. When it is loaded as an `<img>` it cannot see the page's web fonts and falls back to the serif stack. **Before any external use (letterheads, certificates, app icons) convert the text to outlines.** That was not done here because no font tooling or font download was part of this task.
- On phones the wordmark yields to the workspace picker; the mark alone remains, with a visually hidden name.

### 1.4 Brand accent

One accent: **Takusani indigo `#2B3A8C`** (dark theme `#A9B7FF`).

| Pair | Ratio |
|---|---|
| Indigo on canvas `#F7F6F3` | 9.31:1 |
| Indigo on surface `#FFFFFF` | 10.06:1 |
| Indigo on its own tint `#ECEEF8` (selected navigation) | 8.70:1 |
| Indigo on caution tint `#FBF3DB` / info tint `#E1F3FE` (links inside banners) | 9.08:1 / 8.84:1 |
| White on indigo (count badge) | 10.06:1 |
| Dark theme: `#A9B7FF` on canvas / surface / its tint `#23284A` | 9.57 / 8.86 / 7.40:1 |

Why indigo. (1) Blue is the colour people with low technical confidence already read as "link". (2) It is far from every status hue (green, amber, red), so the accent can never be mistaken for a verdict. (3) It is dark enough to pass AAA on every surface, so links, focus rings and the current navigation item share one colour without a contrast exception. (4) It is cooler than the warm canvas, which gives the only chromatic contrast the interface needs.

Use it for exactly four things: links, the focus ring, the current navigation item, and the workspace label above the page title. Primary buttons are ink (off-black), not indigo: the accent marks *where you are and where you can go*, ink marks *what you are about to do*.

### 1.5 Tone of voice

- **Plain and specific.** Say what happened, what it means for the person's work, and what to do next, with the real date. "You can appeal until the end of Tuesday 29 September 2026", never "soon" and never a midnight timestamp.
- **Even-handed.** Outcomes are professional judgements, not prizes or punishments. No "Congratulations!", no "Unfortunately". Never "fail", "failed", "rejected" or "NYC" in learner-facing text.
- **Honest about the system.** Say where data is ("Saved on this device"), say what was recorded and who will look at it, never threaten an outcome the system cannot impose, and never say "failed" while a retry may still succeed.

---

## 2. Design tokens

All tokens are CSS custom properties on `:root` in `tokens.css`. Dark values live under `[data-theme="dark"]` and are repeated under `@media (prefers-color-scheme: dark)` for `[data-theme="auto"]` (System).

### 2.1 Colour: canvas, surfaces, borders, text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-canvas` | `#F7F6F3` | `#141413` | Page background |
| `--color-surface` | `#FFFFFF` | `#1C1C1A` | Cards, tables, inputs |
| `--color-surface-subtle` | `#FBFBFA` | `#20201E` | Table header, card footer |
| `--color-surface-sunken` | `#EFEEEA` | `#252523` | Wells, hover, skeleton |
| `--color-border` | `#E6E4DF` | `#2E2E2B` | Decorative 1px hairline. 1.27:1: not a control boundary and never the only carrier of meaning |
| `--color-border-strong` | `#85837E` | `#85837D` | Control boundaries (inputs, secondary buttons, choice cards) |
| `--color-text-strong` | `#111110` | `#F6F5F1` | Headings, figures |
| `--color-text` | `#1B1B19` | `#ECEBE7` | Body |
| `--color-text-secondary` | `#55544F` | `#B4B2AB` | Labels, help, metadata |
| `--color-text-tertiary` | `#696863` | `#97958E` | Placeholders, overlines |
| `--color-text-disabled` | `#9A9893` | `#6B6A65` | Disabled controls only (exempt from 1.4.3). Never for live content; excluded list rows use secondary text instead |
| `--color-ink` / `-hover` | `#111110` / `#33332F` | `#ECEBE7` / `#D2D0C9` | Primary button, bulk bar, toast, offline banner |
| `--color-accent` / `-hover` / `-subtle` / `-border` | `#2B3A8C` / `#1E2A6B` / `#ECEEF8` / `#C5CBE8` | `#A9B7FF` / `#C4CEFF` / `#23284A` / `#3A4377` | Links, focus, current navigation |

Text contrast (light theme; dark in brackets):

| Foreground | on canvas | on surface | on sunken |
|---|---|---|---|
| text-strong | 17.48 (16.90) | | |
| text | 15.96 (15.45) | 17.25 (14.31) | 14.86 (12.87) |
| text-secondary | 7.02 (8.69) | 7.59 (8.04) | 6.54 (7.24) |
| text-tertiary | 5.17 (6.15) | 5.58 (5.69) | 4.81 (5.12) |
| border-strong (3:1 needed) | 3.50 (4.86) | 3.79 (4.50) | 3.26 (4.05) |
| white on ink / ink-hover | 18.89 / 12.69 (dark: 15.45) | | |

### 2.2 Colour: status tones

Five tones, named as in the UX architecture. Each has `-bg`, `-border` (pale decorative hairline, banners only), `-text` and `-solid` (tag borders, left bars, icons, chart marks).

| Tone | bg | text | solid | text on bg | text on surface | solid on bg | solid on surface | solid on canvas |
|---|---|---|---|---|---|---|---|---|
| neutral | `#EFEEEA` | `#44433F` | `#7D7B76` | 8.53 | | 3.64 | 4.23 | 3.91 |
| info | `#E1F3FE` | `#185A86` | `#2B78AD` | 6.48 | 7.38 | 4.20 | 4.78 | 4.42 |
| positive | `#EDF3EC` | `#2C5A31` | `#3F7D46` | 7.13 | 8.03 | 4.40 | 4.96 | 4.59 |
| caution | `#FBF3DB` | `#7A5200` | `#9A6500` | 6.24 | 6.92 | 4.47 | 4.96 | 4.59 |
| critical | `#FDEBEC` | `#9F2F2D` | `#B5403D` | 6.26 | 7.20 | 4.85 | 5.58 | 5.16 |

Body text (`--color-text`) on any tone background is 15.0:1 or better. Destructive button: white on `#9F2F2D` 7.20:1, hover `#822422` 9.44:1.

Dark theme: text on bg 9.33 / 8.76 / 8.85 / 8.98 / 8.47; solid on bg 4.17 / 5.19 / 5.58 / 6.51 / 5.01; solid on surface 4.94 / 6.41 / 6.59 / 7.87 / 5.49 (neutral, info, positive, caution, critical).

**Tone policy.**

| Tone | Means | Examples |
|---|---|---|
| neutral | A fact with no valence; final or administrative states | Not started, To mark, Planned, Archived, Mark upheld, Not accepted (with reason), Voided |
| info | Something is in progress or waiting on someone else | Being assessed, In review, Received, Saved on this device |
| positive | Done, accepted, in the person's favour | Competent, Submitted, Agreed, Signed off, Delivered, Saved |
| caution | The person should notice or act | Late, Held, **Not yet competent**, Returned, Amended: lower, Overdue (you can still submit), running low on exam time, integrity events to review, offline |
| critical | System faults, blocking validation errors, destructive confirmation, "cannot keep a safety copy" | Email could not be delivered, the LMS is having trouble, field errors, Void attempt. **Never a learner's outcome.** |

### 2.3 Focus ring

`outline: 2px solid var(--color-focus); outline-offset: 2px` on every interactive element through one global `:focus-visible` rule. The ring is the accent, so it contrasts with whatever surface shows through the 2px offset: light 9.31 (canvas), 10.06 (surface), 8.67 (sunken), 9.08 (caution tint), 8.84 (info tint); dark 9.57, 8.86, 7.97, 7.33. On ink surfaces (toast, bulk bar, offline banner) the ring switches to `--color-text-inverse` (18.89:1 light, 15.45:1 dark). Inputs draw the ring at offset 0 and also change their border. Components whose focusable control is hidden inside a card (choice cards, candidate rows, segmented options) draw the ring on the card with `:has(:focus-visible)`.

### 2.4 Typography

Loaded from Google Fonts, all optional: the page is complete on the fallback stacks, and no web font is needed for first paint (learner performance budget).

| Role | Family and stack | Why |
|---|---|---|
| Editorial serif: page titles, dialog titles, key figures, empty-state titles | `"Newsreader", "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif` | A text serif with optical sizes and lining tabular figures; it carries authority without being ornamental. Weights 400 to 600 loaded; 500 used. |
| UI sans: everything interactive and all body text | `"Instrument Sans", "Segoe UI Variable Text", "Segoe UI", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif` | Characterful but quiet, open apertures, clear at 14px, variable 400 to 700. Not Inter, Roboto or Open Sans. |
| Mono: references, timestamps, receipts, counts, the exam timer | `"Geist Mono", "Cascadia Mono", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace` | Unambiguous 0/O and 1/l/I, tabular by nature, lighter on the page than most coding fonts. |

| Token | Size | Use | Line height | Weight | Tracking |
|---|---|---|---|---|---|
| `--text-xs` | 12px | Overlines, table headers, tag minimum is 13px | 1.25 to 1.5 | 600 | 0.04 to 0.06em uppercase |
| `--text-sm` | 14px | Labels, table cells, help, status lines | 1.45 to 1.5 | 400 to 600 | 0 |
| `--text-base` | 16px | Body, inputs, feedback text | **1.6** | 400 | 0 |
| `--text-md` | 18px | Lead, question stem | 1.6 | 400 | 0 |
| `--text-lg` | 20px | Section headings (sans 600); serif panel titles | 1.35 | 600 / 500 | 0 / −0.02em |
| `--text-xl` | 24px | Page title on phones, dialog title (serif) | 1.15 | 500 | −0.02em |
| `--text-2xl` | 30px | Page title from md (serif) | 1.15 | 500 | −0.02em |
| `--text-3xl` | 36px | Key figures (serif, lining tabular) | 1 | 500 | −0.02em |
| `--text-4xl` | 48px | Large exam timer (mono) | 1 | 600 | 0.02em |

Reading comfort for long marking sessions: 16px base, 1.6 line height, `--measure: 38rem` (about 70 to 75 characters; the `ch` unit was rejected because it measures the digit 0 and overshoots to about 95 characters), hard cap 720px (`--width-prose`). Text resizes to 200% without loss because all sizes are in rem.

### 2.5 Spacing, radii, borders, elevation

| Group | Tokens |
|---|---|
| Spacing (4px base) | `--space-1` 4 · `-2` 8 · `-3` 12 · `-4` 16 · `-5` 20 · `-6` 24 · `-8` 32 · `-10` 40 · `-12` 48 · `-16` 64 |
| Radii | `--radius-xs` 4 (kbd, checkbox) · `-sm` 6 (buttons, inputs) · `-md` 8 (cards, banners) · `-lg` 12 (dialogs; the maximum) · `-pill` (filter chips, counts). Tags use 12px, which is a full pill on one line and still tidy when a long label wraps. |
| Borders | `--border`: 1px solid hairline on every surface. `--border-control`: 1px solid `border-strong` on anything operable. Emphasis uses a 3 to 4px left bar or a 1px ink border, never a thicker box. |
| Elevation | `--shadow-none` everywhere. `--shadow-overlay: 0 12px 40px rgb(17 17 16 / 0.05)` for dialog, menu and toast only; the scrim and the 1px border do the separating. |
| Density | Default: 44px controls, 12 × 16 table cells, 24px card padding. `[data-density="compact"]` (desktop marking and table workspaces): 36px controls, 8 × 12 cells, 16px card padding. Never compact on phones, in navigation, in sticky bars or in the exam. |

### 2.6 Z-index, motion, breakpoints, layout

| Group | Tokens |
|---|---|
| Z-index | `--z-sticky` 100 · `--z-nav` 200 (top bar, bottom tabs, sticky action bars, exam bar) · `--z-sheet` 300 · `--z-menu` 350 · `--z-modal` 400 · `--z-toast` 500 · `--z-exam` 600 (integrity overlay) |
| Motion | `--duration-fast` 120ms · `-base` 160ms · `-slow` 200ms; `--ease-standard` and `--ease-out`. State changes only: hover, press (scale 0.98), dialog and sheet entry, toast entry, progress. **No scroll-entry animation, no staggered reveals, no ambient motion.** `prefers-reduced-motion: reduce` removes all of it; spinners become static dotted rings next to their text. |
| Breakpoints (min-width, mobile first from 320) | `md` 768 (48rem) · `lg` 1024 (64rem) · `xl` 1280 (80rem) · `2xl` 1440 (90rem) |
| Layout | `--topbar-height` 56 · `--sidenav-width` 256 · `--rail-width` 72 · `--bottomtabs-height` 60 · `--actionbar-height` 72 · `--switcher-height` 48 · `--exam-navigator-width` 240 · `--width-content` 1200 · `--width-prose` / `--width-form` 720 · `--width-auth` 416 · aside 320 to 400 · marking panel 420 to 480 |

---

## 3. Domain status vocabulary

Rules: a status is always text; tone and shape support it. Shapes are part of the tag (CSS, no icon font): neutral ring, info dot, info-in-progress half disc (`--shape-half`), positive check, caution diamond, critical cross, neutral-final square (`--shape-square`), none (`--plain`). Labels are sentence case and never truncate; long labels wrap. Learner labels and staff labels differ where the UX catalogue says so. **While a result is held the learner sees exactly one label, "Being assessed"; staff see "Decided [date]" and, later, "Released [date]".**

### 3.1 Submission

| Data-model state | Learner label | Staff label | Tone | Class |
|---|---|---|---|---|
| No version, before due | Not started | Outstanding | neutral | `tag` |
| No version, after due | Overdue. You can still submit | Outstanding (overdue) | caution | `tag tag--caution` |
| `upload_pending` | Upload in progress / Paused / Expired | Outstanding | info | `tag tag--info tag--shape-half` |
| `finalised` (draft: files uploaded, not submitted) | Ready to submit | Outstanding | info | `tag tag--info` |
| `submitted`, on time | Submitted, version N | To mark | positive (learner) / neutral (staff) | `tag tag--positive` / `tag` |
| `submitted`, late flag | Submitted, version N, Late | To mark, Late | caution | `tag tag--caution` |
| Under assessment (`queued`, `marking`, finalised and held, returned, re-marked) | **Being assessed** | see 3.4 | info | `tag tag--info tag--shape-half` |
| Returned to the learner: released NYC, resubmission open | Resubmission open, due end of [day] | Waiting for resubmission | caution | `tag tag--caution` |
| Resubmitted (`submitted`, version > 1) | Submitted, version N | To mark | positive / neutral | as above |
| Earlier version | Replaced by version N (kept on record) | In version history | neutral | `tag tag--shape-square` |

### 3.2 Exam attempt

| State | Learner | Staff | Tone | Class |
|---|---|---|---|---|
| `active` | In progress. Time left [hh:mm] | In progress, last save [time] | info | `tag tag--info tag--shape-half` |
| `submitted` | Submitted [time] | To mark | positive / neutral | `tag tag--positive` / `tag` |
| `expired` (auto-submitted) | Submitted automatically when time ran out | To mark, Auto-submitted | positive / neutral | `tag tag--positive` / `tag` |
| `voided` | Attempt cancelled by your coordinator. New attempt available | Voided by [name], reason | neutral | `tag tag--shape-square` |
| Flagged for review | Nothing beyond the in-exam message | Integrity events to review (sorted first) | caution | `tag tag--caution` |

### 3.3 Answer persistence (`.status-line`, wording is fixed)

| State | Wording | Tone | Class | Icon |
|---|---|---|---|---|
| Request outstanding > 2 s | Saving | neutral | `status-line` + `.spinner` | |
| Local only | Saved on this device | info | `status-line status-line--local` | `device` |
| Server acknowledged | Saved 10:42 | positive | `status-line status-line--saved` | `cloud-check` |
| Terminal | Submitted and locked | neutral, strong | `status-line status-line--locked` | `lock` |
| Offline | Not saved to the server. Your answers are being kept on this device. | caution | `status-line status-line--problem` | `offline` |
| Recovered | Back online. All answers saved. | positive | `status-line status-line--saved` | `cloud-check` |
| No safety copy | This device cannot keep a safety copy. Only "Saved" answers are safe. | critical | `status-line status-line--critical` | `warning` |

### 3.4 Result

| State | Learner | Staff | Tone | Class |
|---|---|---|---|---|
| No result yet | Being assessed | To mark / Marking, draft saved [time] | info | `tag tag--info tag--shape-half` |
| `held` (every sub-state) | **Being assessed** | Decided [date]. Held (+ reason: waiting for a cycle, in moderation, sampled, returned to you) | info / caution | learner as above; staff `tag tag--caution` |
| `released`, Competent | Competent | Competent · Decided [date]. Released [date] | positive | `tag tag--positive` (`tag--lg` on the result) |
| `released`, Not yet competent | Not yet competent, then the next step and its date | Not yet competent · Decided. Released | caution | `tag tag--caution` |
| Superseded | Changed after appeal on [date] / Corrected on [date] | Amended on appeal / Corrected | neutral | `tag tag--plain` + `.history-list` |

### 3.5 Moderation cycle and sample item (staff only; learners see "Being assessed", then "Result ready")

| Cycle state | Label | Tone | | Sample item state | Label | Tone |
|---|---|---|---|---|---|---|
| `planned` | Planned | neutral | | `allocated` | To review | neutral |
| `frozen_and_sampled` | Sampled. Ready for review (N items) | info | | `in_review` | In review | info (half) |
| `in_review` | In review (14 of 22 done) | info (half) | | `agreed` | Agreed | positive |
| `corrections_pending` | Waiting for re-marks (N outstanding) | caution | | `returned` | Returned to assessor, due [date] | caution |
| `signed_off` | Signed off. N results released | positive | | `remarked` | Re-marked. Review again | info |
| `cancelled` | Cancelled. Results still waiting | neutral (square) | | `reallocated` | Reallocated to [name] | neutral (square) |

### 3.6 Appeal

| State | Learner | Coordinator | Tone |
|---|---|---|---|
| `lodged` | Received | New. Needs admissibility check | info |
| `admissibility_review` | Being checked | Being checked | info (half) |
| `admitted` | Accepted (script request: Granted) | Accepted. Needs a reviewer | info (script granted: positive) |
| `inadmissible` | Not accepted, with the reason | Inadmissible: [reason] | neutral (square) |
| `allocated` | With a reviewer | Allocated to [name] | info |
| `under_review` | Being reviewed | Under review by [name] | info (half) |
| `concluded`, upheld | Decided: mark upheld | Concluded: upheld | neutral (`tag--shape-check`) |
| `concluded`, amended up | Decided: mark changed (higher) | Concluded: amended upward | positive |
| `concluded`, amended down | Decided: mark changed (lower) | Concluded: amended downward | caution |
| Window closed, no appeal | The time to appeal closed at the end of [day] | | neutral (`deadline-line--closed`) |

### 3.7 Notification delivery and cohort

| Delivery state | Recipient | Coordinator log | Tone | | Cohort state | Label | Tone |
|---|---|---|---|---|---|---|---|
| `pending`, `queued` | Email: sending | Queued | neutral (half) | | `active` | Active | positive (dot) |
| `accepted` | Email: sent [time] | Accepted by mail provider | info | | `completion_review` | Completion review | info (half) |
| `delivered` | Email: delivered [time] | Delivered | positive | | `archivable` | Ready to archive | neutral |
| `failed` | Email could not be delivered | Failed, with reason | critical (a system fault) | | `archived` | Archived (read-only) + `.banner--readonly` on every page | neutral (square) |
| In-app record | In the LMS: [time]; First opened by you: [time] | Created / Opened | | | `moderation_policy` | Moderated / Not moderated | `tag--plain` |

---

## 4. Component specifications

Class names follow `.block`, `.block__element`, `.block--modifier`; state is `.is-*` or a native/ARIA attribute; JavaScript hooks are `data-*` only. Every component below is rendered in every state in `prototype/components.html`. States common to all interactive components: **hover** (surface-sunken fill or ink border, 120ms), **focus-visible** (section 2.3), **active** (scale 0.98 on buttons), **disabled** (sunken fill, hairline border, disabled text, `not-allowed`; a blocked action also prints its reason as text).

### 4.1 Shells

| Shell | Anatomy | Rules |
|---|---|---|
| **AuthShell** `.auth-shell` | `__header` (institution name in serif, then `.brand`), `__main` > `__card` (one form column, 416px), `__footer` (help link, Appearance `.segmented`) | No navigation. Do: lead with the institution. Don't: add marketing content or illustration. |
| **AppShell** `.app-shell` | `__topbar` (fixed 56px: `.brand`, `.topbar__institution`, `.topbar__context`, `.topbar__spacer`, `.topbar__search`, `.topbar__actions` with bell and account menu; phones add `.topbar__workspace`), `__sidenav`, `__main` (first focusable region after the skip link), optional `.bottom-tabs`, `.action-bar` | Phones: top bar + bottom tabs; the side navigation is not rendered visually. md: 72px icon rail (icon + short label, count as a corner badge). lg: 256px SideNav. The top bar never holds page actions. |
| **ExamShell** `.exam-shell` | `__bar` (`.exam-bar`), `__banner` (offline), `__navigator` (`<details>`, 240px from lg, collapsible), `__main` (one question), `__actions` | **No navigation components at all**: no `.sidenav`, `.bottom-tabs`, bell, search, account menu or brand link. Skip links first. Reflows to 320px for 400% zoom. Follows the same theme setting. Print hides the question. |

**SideNav** `.sidenav`: `__group` per workspace (Learning, Teaching, Assessing, Moderating, Appeal reviews, Coordinating, Administration), `__heading`, `__list`, `__item` (icon, `__label`, `__short` for the rail, `__count`). A group renders only if the person holds the role; a single-role user gets a flat list with no heading. Current page: `aria-current="page"` gives accent text, tint fill, a 3px left bar and semibold weight (four cues, not colour alone). There is **no role switcher**. Counts never reveal anything a learner must not infer.

**Workspace picker (phones only)**: `.topbar__workspace` button opens `dialog.modal.modal--sheet` listing held workspaces as `.menu__item` rows with counts. It is navigation, not a mode. Not rendered for single-role users.

**Context selector** `.context-select__button` inside `details.menu-wrap[data-menu]`: cohort or programme filter. Each option shows cohort, programme, status and the moderation-policy tag; archived cohorts sit under their own heading. A convenience filter, never an authorisation input.

**Account menu** `details.menu-wrap` + `.menu.menu--end`: `.account__identity` (name, email, read-only `.account__roles`), profile, notification preferences, Appearance (`.segmented`: Light, Dark, System), help, sign out.

**Bottom tabs** `.bottom-tabs` / `__item`: phones only, at most five (four destinations + More), icon above an always-visible label, 44px+ targets, current tab has a top bar and semibold accent text. Hidden automatically while an `.action-bar` or `.decision-bar` is present.

**PageHeader** `.page-header`: `.breadcrumb` (from lg), `__workspace` (accent overline: "Assessing"), `__title` (serif H1, one per page), `__lead`, `__meta` (**one** status tag, cohort name + policy tag, reference), `__actions` (**at most one** primary button and an overflow `menu-wrap`). Don't: put two primaries, or a status tag per fact.

**Sticky regions and WCAG 2.4.11.** Every sticky region feeds `--sticky-top` or `--sticky-bottom` on `html` through `:has()`, and `scroll-padding-top/bottom` is derived from them, so a control scrolled into view by focus or by an anchor is never hidden behind the top bar, section switcher, bottom tabs, action bar, decision bar, exam bar or exam action bar. The marking panel, being its own scroller from xl, has its own `scroll-padding-block`.

### 4.2 Actions

| Component | Variants | Notes |
|---|---|---|
| Button `.btn` | `--primary` (ink), `--secondary` (surface + control border), `--ghost`, `--destructive` (critical fill), `--destructive-quiet`; sizes default 44px, `--sm` 36px (dense desktop toolbars only), `--lg` 52px; `--block`, `--icon` (needs `aria-label`); `.is-loading` + `aria-busy` (label kept for assistive technology; spinner replaces it visually) | Do: one primary per view; verbs that name the object ("Finalise decision"). Don't: use `--sm` in navigation, sticky bars or the exam; use destructive styling for ordinary negative choices ("Go back"). Unknown outcome of a retried command reads "Checking whether your work went through...", never "Failed". |
| `.blocked-reason` | caution text beside a disabled button, linked with `aria-describedby` | The reason is visible text, not only a disabled state, and never a tooltip. |
| Link `a`, `.link` | default (accent, underlined), `--quiet` (inherits colour, grey underline), `--standalone` (icon + label, 24px min height) | Always underlined: colour is never the only cue. External or app-switching links say so in hidden text. |
| `.action-bar` | sticky bottom bar on phones for the page's one primary action | Full-width button. Replaces bottom tabs while present. |

### 4.3 Forms

| Component | Anatomy | States and rules |
|---|---|---|
| Field `.field` | `__label` (+ `__required` / `__optional` in words), `__help` (before the control), control, `__error` or `__valid` (icon + text), `__footer` with `__count` | Error: `aria-invalid="true"`, 1px + inset 1px critical border, message linked by `aria-describedby`, message says what happened and what to do. On submit, `.error-summary` (`role="alert"`, focus moved to it) lists errors as links. Read-only: dashed border. Disabled: sunken. Single column, 720px maximum. |
| `.input`, `.textarea` (`--feedback` 12rem tall, measure-limited), `.select > select`, `.input-icon`, `.input--mono` | native elements, 44px, 16px text (prevents iOS zoom) | Hover darkens the border; focus ring at offset 0. |
| Checkbox / radio `.check` | native input (`accent-color`), `__label`, `__help`; `--bare` for table rows (24px) | The whole label row is the 44px target. Disabled options state why in `__help`. |
| Choice card `.choice` in `.choice-group` (`--2`) | native radio/checkbox stays visible + `__title`, `__desc`, `__meta`; tone variants `--positive`, `--caution` when checked | Selection = native control + ink border + tint: never colour alone. Grids are intrinsic (`auto-fit`), so a 420px panel behaves like a 420px phone. |
| Segmented `.segmented` | radios presented as 2 to 4 segments | Appearance control; any small exclusive choice. |
| Candidate list `.candidate-list` | `__tier` + `__tier-title`, `.candidate` rows (radio, `__name`, role tag, `__note`), `__empty` for an empty tier, `.candidate.is-excluded` with `__reason` | Excluded people stay in the list as disabled rows; the exclusion reason is visible text linked with `aria-describedby`, in normal text colour. Skipping a tier asks for a reason. |
| Date-time `.datetime` | `<time datetime="...+02:00">` with `__time`, `__zone`; `--stacked` | Always South African time whatever the device zone. Compact "22 Sep 2026, 14:05" in tables and logs; "(SAST)" once per sentence and in column headers, not every cell. 24-hour clock. Never render 00:00 or 24:00. |

### 4.4 Upload (resumable)

`.upload` > `__drop` (dashed control border; `.is-dragover`, `.is-disabled`; a real `<input type="file">` behind a label-button, so it works by keyboard and without drag) + `__list` of `.upload-row` (`__icon`, `__name`, `__status`, `__actions`, optional `.progress`).

| Row state | Status wording | Treatment |
|---|---|---|
| `--waiting` | Waiting · 1.1 MB | dashed border |
| `--uploading` | Uploading 42% · 5.0 of 12.0 MB | progress bar, pause button |
| `--paused` | Paused at 31%, no connection. It will carry on by itself when you are back online. | caution border and bar, "Try now" |
| `--resuming` | Resuming from 67% | spinner + bar |
| `--checking` | Checking file | indeterminate bar |
| `--uploaded` | Uploaded · 4.2 MB | positive text, remove button |
| `--rejected` | Not accepted + the limit, the reason and what to do instead | critical border and text (blocking validation) |
| `--expired` | Expired. This upload was paused for too long. Choose the file again. | caution, "Choose again" |

Don't: show a bare percentage without the file name; say "failed" for a pause; rely on the bar colour.

### 4.5 Data table and its card transformation

`.table-wrap` (`--sticky` for a sticky header) > `.table` (`--compact`, `--cards`). Header cells: 12px uppercase; sortable headers are `<button class="table__sort">` inside `th[aria-sort]` with an arrow glyph that changes with the state. Cells: `.table__primary` + `.table__secondary`, `.table__num` (right-aligned tabular), `.table__check`, `.table__actions`. Selected row: `.is-selected` (tint + 3px accent bar). Toolbar: `.table-toolbar` with search, `.filter-chip[aria-pressed]` (+ `__count`), `__end`. Bulk actions: `.bulk-bar` (ink, sticky above any sticky bottom region). Pagination (`.pagination`, 44px items), never infinite scroll.

Below 768px a `.table--cards` table becomes a card list: header visually hidden, each row a bordered card, each cell a label/value pair from `data-label`, the `.table__primary-cell` becomes the card title, the action becomes a full-width button. **Bulk selection on phones is an explicit Select mode**: a `.table__select-mode` button (`data-select-mode="#wrap"`) toggles `.is-selecting`, which reveals a 44px checkbox on each card and the bulk bar. No long-press. Production note: when a table is displayed as blocks, some browsers drop table semantics; the React build should render a real list of cards below md rather than restyle the table. Inherently two-dimensional tables (audit log, sampling strata) instead scroll inside a focusable, labelled region.

### 4.6 Status, feedback and overlays

| Component | Spec |
|---|---|
| Tag `.tag` | tone modifiers `--info`, `--positive`, `--caution`, `--critical` (default neutral); shape overrides `--shape-ring`, `-dot`, `-half`, `-check`, `-diamond`, `-cross`, `-square`; `--plain`; `--lg` for the outcome. 13px semibold sentence case, 1px border in the tone's solid (3:1 or better against the tag fill and the page in both themes). Deviation from the source direction: not uppercase, because sentence case is easier to read for people with lower reading confidence and "Not yet competent" should not shout. |
| Status line `.status-line` | persistent text in a fixed place with `role="status"`; modifiers `--local`, `--saved`, `--locked`, `--problem`, `--critical`; `__time`. Autosave, drafts, uploads. Never a toast. |
| Banner `.banner` | `__icon`, `__title`, `__body`, `__actions`; tones `--info`, `--positive`, `--caution`, `--critical`; `--readonly` (archived cohort: dashed, ink bar, archive icon); `--offline` (ink, full bleed, not dismissible while offline, does not cover content or block input); `--sticky`, `--compact`. In the page flow under the header. `role="status"` or `role="alert"` by severity. |
| Conflict panel `.conflict` | `__title` (names the rule: "This would break separation of duties"), `__body` (one sentence naming the person and the reason, and that nothing was changed), `__evidence` (definition list of each conflicting decision, role and allocation, linked), `__rule` (mono: rule id, error code, reference, time), `__actions` (alternatives; **no retry**). `role="alert"`, focus moves to the heading. Caution bar with an ink border: a refusal is serious, but it is not a system fault. |
| Toast `.toast-region` > `.toast` | polite live region present from load; ink surface; title, body, mono meta, close. 6 seconds, pauses on hover and focus. Low-stakes confirmations only ("Reminder sent"). Never for errors, saving, or anything that needs action. |
| Dialog `dialog.modal` | `__header` > `__title` (serif), `__body`, `__footer` (buttons stack on phones with the safe action nearest the thumb). Native `showModal()`: focus trapped, Escape closes, focus returns to the trigger. |
| Consequence dialog | a `.modal` with `data-modal-static` (no backdrop dismissal), a `.modal__consequence` sentence that states the effect in plain words **with the number of people affected**, the capacity ("You are signing off as the moderator"), an acknowledgement checkbox gating the confirm button (`data-requires`), and **default focus on the cancel action**. Used for finalise, freeze and sample, sign-off and release, lodge remark, submit exam. The confirm button is ink, not red: these are irreversible, not destructive. |
| Sheet `.modal--sheet` (`--full`) | ordinary dialogs on phones: full-width bottom sheet below md, centred from md. Workspace picker, sort and filter, decision sheet. Consequence dialogs remain centred true modals at every size. |
| Empty state `.empty` | `__icon` tile, serif `__title`, `__body` (what will appear here and when), `__actions`. No illustration needed. |
| Skeleton `.skeleton` | `--text`, `--title`, `--block`, `--tag`; region has `aria-busy="true"` and hidden "Loading ..." text; opacity pulse, off under reduced motion. |
| Checklist `.checklist` | rows with icon, title, a word tag (Pass, Problem, Checking) and `__detail` with the one-line fix. Device check, readiness, archive preconditions. |

### 4.7 Process and time

| Component | Spec |
|---|---|
| Tabs `.tabs` | `[role=tablist]` > `.tabs__tab[aria-selected]` (+ `__count`), `.tabs__panel`. 44px tabs, 3px ink underline + semibold for the selected tab, arrow keys, Home, End. |
| Stepper / appeal timeline `.stepper` | vertical by default (the appeal tracker); `--horizontal` from md (moderation progress). Step states `.is-complete` (filled ink + check glyph), `.is-current` (accent ring, `aria-current="step"`), `.is-blocked` (caution, "!"), `.is-skipped` (dashed, en dash), upcoming (number). `__label`, `__meta` (mono time), `__body`. Every state also has visually hidden text. |
| Deadline line `.deadline-line` | icon + sentence with `__date` (bold) and `__left` (mono); `--soon`, `--closed`. **Written as the last full day**: "until the end of Tuesday 29 September 2026"; "Today is the last day to appeal"; calendar days stated when it matters. On the result, the marked script, the dashboard card and the notification: in the first screenful, never behind a click. |
| Deadline chip `.deadline` | compact form for tables, cards, agenda: default, `--soon` (caution), `--overdue` (caution, 2px border, "You can still submit"), `--closed` (neutral, dashed). Relative time only in addition to the date. |
| Exam timer `.timer` | `__label` + mono `__value`; `--low` (caution, label becomes "5 minutes left"), `--ended`, `--lg`. Server-authoritative, never pauses. The ticking value is not a live region; one polite announcement at 15, 5 and 1 minute. No red, no flashing, no sound. |

### 4.8 Assessment workspace

| Component | Spec |
|---|---|
| Workspace `.workspace` | `__evidence` + `__panel`. **Two panes only from xl (1280)**: flexible evidence, 420 to 480px sticky panel. Below xl the sections stack under a sticky `.section-switcher` (anchor links, `aria-current="true"`), with a sticky `.decision-bar`. |
| Decision bar and sheet `.decision-bar` | `__summary` (outcome so far, what is missing), `__actions` (Save draft, Finalise), `__open` (phones: one button that opens the decision sheet, a `.modal--sheet.modal--full`). |
| Evidence viewer `.viewer` | `__toolbar` (file name, page, version switcher), `__body` (sunken well), `__page`. |
| Rubric `.rubric` | one `fieldset.rubric__row` per criterion: `__head` (`__id` mono, `__title`, `__score`), `__desc`, `__levels` (choice cards with points), comment field; `.is-unscored` adds a caution bar and "Not scored"; `__total` with serif `__total-value`; `--readonly` for moderators and marked scripts. Keyboard: Tab between criteria, arrows within levels. |
| Decision panel `.decision` | ink-bordered card: `__header`, `__body` (outcome as two choice cards `--positive` / `--caution`, **required** justification, `__remediation` block required for Not yet competent: actions + "Resubmit by the end of" date), held/released notice, `__footer` with `__attribution` ("You are deciding as the assessor") and the draft status line. A decision is never edited; a new one is recorded. |
| Learner result `.result` | `__head` (`__outcome`: unit overline + `tag--lg`; `__marks`: serif figure with the outcome in words beneath it), `__body` (next-step banner for NYC, `.deadline-line`, feedback introduced as the assessor's view), `__footer` ("Released on ... You were notified ..."). Outcome, next step and both clocks are above the first scroll on 360 × 640. |

### 4.9 Exam

| Component | Spec |
|---|---|
| Exam bar `.exam-bar` | `__title`, `__position` ("Question 7 of 40"), status line, `__closes` (when the window shortens the attempt), `.timer`. |
| Question `.question__number`, `__stem` (receives focus on question change), choice cards or textarea, `__notice` (status line for "Pasting is switched off during this exam."). |
| Question navigator `.qnav` > `__item` | four states, each with a non-colour cue and its name in the accessible label: **unanswered** (outline), **answered** `.is-answered` (filled + check), **come back to** `.is-marked` (corner bookmark; the learner's own marker, never called a flag), **current** `[aria-current="true"]` (3px ring + underline + semibold). `.is-local` adds a dotted underline: the latest edit is on this device only. `__key` prints the legend in words. 44px targets. |
| Integrity overlay `.exam-overlay` + `.exam-notice__panel--caution` | `role="alertdialog"`, covers the question, traps focus, one button ("Return to the exam"). Says what happened, that it was recorded, who will look, and that the timer is still running. Caution tone. Never threatens an outcome, never shows the threshold. |
| Takeover screen and mobile gate `.exam-notice` | full-page `__panel` with serif `__title`, `__body`, mono `__fact` (true time left, or the exam window), `__actions`. Takeover (`lease_lost`): "Continue here instead" and "Close this tab", no "Try again", no answers shown. Mobile gate: runs before an attempt exists, names the window, points to the coordinator. |

### 4.10 Records

| Component | Spec |
|---|---|
| Receipt `.receipt` | `__title`, `__id` (mono, large, `user-select: all`), `__rows` (definition list, mono values), `__note` (what happens next), `__actions` (print, copy). Print styles keep only the receipt. Reachable again later. |
| History list `.history-list` | submission versions and decision chains: `__badge` (v2, or sequence), `__title`, `__meta`, `__actions`; `.is-current` has an ink bar and a "Current" tag. Nothing is edited; superseded records stay visible. |
| Audit / event log `.log` (`--boxed`) | `__item` (`--marked` for integrity events: caution bar), mono `__time`, `__actor`, `__event`, mono `__detail`. Append-only, chronological, paginated. |
| Delivery evidence `.delivery-evidence` | `<details>` "How you were told": `__row` per channel with its state in words and its time; `__row--failed` links to the address check. On notification rows, the released result, and the coordinator's appeal detail. |

### 4.11 Calendar, notifications, figures

| Component | Spec |
|---|---|
| Calendar `.calendar` | `__toolbar`, `__grid` of `__weekday` and `__day` (`--outside`, `--today` with hidden "Today"), `__event` (`--session` dot, `--exam` square, `--due` diamond; each has a hidden type word). Below md the grid shows markers only. |
| Agenda `.agenda` | the default below lg: `__day-title`, `__item` (`__time` mono, `__title`, `__meta` with join link or deadline chip). End-of-day deadlines appear as "All day: Last day to ...". |
| Notification `.notification-list` > `.notification` | `__icon`, `__title` (link), `__time`, `__body`, `__unread` dot, `__extra` (delivery evidence). Unread = semibold + accent bar + dot + hidden "Unread:". `.badge-count` on the bell. |
| Stat tile `.stat` | `__label`, serif `__value` (+ `__unit`), `__meta`, `__delta` in words ("1.5 days faster"), never a bare arrow or colour. |
| Credits `.credits` | serif `__figure` ("52 of 140 credits earned"), `__bar` with `--earned` and `--outstanding` segments, `__legend` with the numbers. **No "pending" segment**: a held result is invisible to its learner, so only released Competent results count. |

---

## 5. Layout

| Screen type | Container | Behaviour |
|---|---|---|
| Reading (material, feedback, result) | `.page.page--prose`; text limited to `--measure` | One column; optional `.page-layout` aside (320 to 400px) from lg, below main before that |
| Form | `.page.page--form` (720px) | Single column; help under fields; sticky `.action-bar` on phones |
| Dashboard, table, report | `.page` (1200px cap) | `.grid--2/3/4`: one column on phones, two from md, three or four from xl |
| Workspace (marking, moderation, appeal review) | `.page--full` + `.workspace` | Two panes from xl only; stacked with section switcher and decision bar below |
| Exam | `.exam-shell` | Navigator 240px + question (720px) from lg; stacked below |
| Sign-in | `.auth-shell` | One 416px column |

Gutters: 16px on phones, 24px from md. Vertical rhythm: 24px between blocks, 40px between sections (`.section`). No section has landing-page padding: screens are dense but calm, separated by hairlines rather than by empty space.

---

## 6. Iconography

- **Default set: the inline SVG sprite in `ui.js`** (60 icons, 24px grid, 2.4px round strokes, the visual weight of Phosphor Bold). It is injected into the page at load, works from `file://`, needs no network, and inherits `currentColor`. Use `<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>`.
- **Extended set: Phosphor Icons, Bold weight** (Fill for a selected state), from the CDN in the prototype and from `@phosphor-icons/react` in production. No thin-line sets (Lucide, Feather, Heroicons outline).
- Icons are always decorative: every icon sits next to visible text, or the control has an `aria-label`. If the CDN fails nothing is lost.
- Status shapes inside tags are CSS, not icons, so that they cannot fail to load.
- Reserved meanings: `scales` = moderation, appeals, separation of duties; `lock` = held, locked, read-only; `device` / `cloud-check` / `offline` = the three places data can be; `shield-warning` and `flag` = exam integrity only; `bookmark` = the learner's "come back to" marker (never `flag`); `refresh` = resubmit or re-mark. The caution triangle (`warning`) is for system faults only, never next to a learner's outcome.
- Sizes: 1em in chips, 1.25em inline with text (default), 24px in empty states and notices, 32px in the upload drop zone.

## 7. Data visualisation

Only what reports need (FR-708): counts, rates, turnaround, credit accumulation.

- **Forms**: horizontal bars for comparison across units, assessors or cohorts (`.bar-chart`); a single-series trend line for turnaround or volume over time (`.sparkline`, or the same marks at larger size); stat tiles for headline numbers; the credits bar for part-to-whole. No pies, donuts, gauges, stacked areas or dual axes.
- **Ink first**: marks are `--color-text-strong`. Colour appears only to carry a status (for example the lowest unit in caution) and the same fact is stated in the caption.
- **Direct labels**: the value is printed at the end of each bar in mono. No legends in boxes, no gridlines, no axis chrome beyond a baseline, no 3D, no gradients, no animation on load.
- **Accessible**: every chart is `role="img"` with an `aria-label` that reads the data, has a one-sentence caption stating the finding, and sits next to a table or export of the same numbers. Marks are 3:1 or better against the surface.
- Competency rates are never phrased as pass or fail rates.

---

## 8. Implementation mapping

### 8.1 Tokens to Tailwind CSS v4

Keep `tokens.css` as the source of truth and expose it to Tailwind with `@theme inline`, so utilities resolve to the same variables and the dark theme keeps working by attribute:

```css
/* app/globals.css */
@import "tailwindcss";
@import "./tokens.css";            /* :root, [data-theme="dark"], [data-theme="auto"] */

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  /* colour: bg-canvas, text-text-secondary, border-border-strong, bg-caution-bg, text-critical-text ... */
  --color-canvas: var(--color-canvas);
  --color-surface: var(--color-surface);
  --color-surface-subtle: var(--color-surface-subtle);
  --color-surface-sunken: var(--color-surface-sunken);
  --color-border: var(--color-border);
  --color-border-strong: var(--color-border-strong);
  --color-text: var(--color-text);
  --color-text-strong: var(--color-text-strong);
  --color-text-secondary: var(--color-text-secondary);
  --color-ink: var(--color-ink);
  --color-accent: var(--color-accent);
  --color-accent-subtle: var(--color-accent-subtle);
  --color-caution-bg: var(--color-caution-bg);      /* repeat for each tone x bg, text, solid, border */
  --color-caution-text: var(--color-caution-text);
  --color-caution-solid: var(--color-caution-solid);

  --font-serif: var(--font-serif);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);

  --text-xs: 0.75rem;  --text-sm: 0.875rem;  --text-base: 1rem;  --text-lg: 1.25rem;
  --text-xl: 1.5rem;   --text-2xl: 1.875rem; --text-3xl: 2.25rem;
  --leading-normal: 1.6;

  --radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px;
  --shadow-overlay: var(--shadow-overlay);

  --breakpoint-md: 48rem; --breakpoint-lg: 64rem; --breakpoint-xl: 80rem; --breakpoint-2xl: 90rem;
  --breakpoint-sm: initial;        /* the UX spec has no 640 breakpoint: remove it */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

Notes: the 4px spacing scale is Tailwind's default (`p-4` = 16px), so no spacing override is needed. Because token names are already in Tailwind's namespaces (`--color-*`, `--font-*`, `--radius-*`), `@theme inline` can alias them one to one. Load fonts with `next/font/google` (Newsreader, Instrument Sans, Geist Mono) with `display: "swap"` and assign their CSS variables to `--font-serif`, `--font-sans`, `--font-mono`; this removes the Google Fonts request and the layout shift. Set `data-theme` on `<html>` from a cookie in the root layout so Server Components render the right theme without a flash.

**Porting `ui.css`.** Move each block into `@layer components` unchanged (it uses only tokens), then migrate block by block to React components that apply the same class names or the equivalent utilities. Because state is already expressed through ARIA and native attributes, the selectors survive the move.

### 8.2 Component base: React Aria Components

**Recommendation: React Aria Components (Adobe) for interactive widgets; plain server-rendered HTML with these classes for everything else.**

| Criterion | React Aria Components | Radix + shadcn/ui |
|---|---|---|
| Accessibility depth | Built and tested against screen readers across platforms; handles touch, keyboard and virtual-cursor interaction uniformly. The project's bar is WCAG 2.2 AA under external audit. | Good primitives; more of the final behaviour is left to the copied component code. |
| Coverage of what this product needs | Table with selection and sorting, GridList, ComboBox, DatePicker, Calendar, RangeCalendar, Tabs, Dialog, Popover, Menu, Toast, ProgressBar, Meter, RadioGroup, FileTrigger/DropZone | No table, calendar, date picker or combobox primitive; shadcn adds them from other libraries (TanStack Table, react-day-picker, cmdk), each with its own accessibility behaviour. |
| Dates and locale | Built-in internationalised date handling: `en-ZA` formatting, 24-hour time, and a fixed `Africa/Johannesburg` zone are first-class. Deadlines and SAST display are central to this product. | Depends on the bolted-on picker. |
| Styling | Unstyled; exposes state as data attributes and render props; has a Tailwind plugin. Maps cleanly onto this system's state selectors. | Unstyled primitives + pre-styled copies that would have to be restyled away from the shadcn look. |
| Next.js App Router | Client components used as leaves; pages stay Server Components. Tree-shakeable, but heavier than Radix per widget. | Same pattern, lighter per widget, larger ecosystem of examples. |

The weight matters because learner routes have a 170 KB JavaScript budget. It is met by **not using a component library where HTML already does the job**: this prototype's menus (`<details>`), dialogs and sheets (`<dialog>`), disclosure (`<details>`), forms, tables, banners, tags, steppers and status lines need no library at all and work before scripts load. Use React Aria only for: ComboBox/Select where native select is not enough, the staff data table (selection, sorting, keyboard grid), DatePicker/Calendar, Tabs, Toast queue, the exam overlay's focus management, and file DropZone. Learner pages will mostly ship none of it.

State selector mapping when a block moves onto React Aria:

| `ui.css` selector | React Aria equivalent |
|---|---|
| `[aria-selected="true"]`, `.is-selected` | `[data-selected]` |
| `[aria-current="page"]` | `[data-current]` (Link) |
| `[aria-invalid="true"]` | `[data-invalid]` |
| `:disabled`, `[aria-disabled="true"]` | `[data-disabled]` |
| `:focus-visible` | `[data-focus-visible]` (keep the global rule as well) |
| `:hover`, `:active` | `[data-hovered]`, `[data-pressed]` (avoids sticky hover on touch) |
| `[aria-pressed="true"]` | `[data-selected]` (ToggleButton) |
| `[aria-sort]` | `[data-sort-direction]` on Column |
| `.is-dragover` | `[data-drop-target]` on DropZone |
| `dialog[open]` | `Modal[data-entering]` / `[data-exiting]` for the 200ms entry |

---

## 9. Deviations from the `minimalist-ui` direction, and why

| Source direction | This system | Reason |
|---|---|---|
| Secondary text `#787774` | `#55544F` (secondary), `#696863` (tertiary) | `#787774` is 4.14:1 on `#F7F6F3` and 4.48:1 on white: fails 4.5:1 |
| Borders `#EAEAEA` everywhere | `#E6E4DF` for decorative hairlines only; `#85837E` on anything operable | `#EAEAEA` is 1.20:1: fails 3:1 for control boundaries (WCAG 1.4.11) |
| Pastel tag text: blue `#1F6C9F`, yellow `#956400`, green `#346538` | `#185A86`, `#7A5200`, `#2C5A31`; red `#9F2F2D` kept | Blue 4.98:1 and yellow 4.62:1 pass on paper but are marginal at 13px semibold; darkened to 6.48 and 6.24. Green moved from 6.08 to 7.13 to stay balanced with the others. |
| Tags with borderless pastel fills | 1px border in the tone's solid colour | Tag boundary 3:1 in both themes, as the UX architecture requires |
| Uppercase, wide-tracked 12px pill tags | Sentence case, 13px, wraps | Readability for varied reading confidence; "Not yet competent" must not shout; labels never truncate |
| Primary button `#111111` with 4 to 6px radius | Kept: `#111110`, 6px | |
| `py-24` to `py-32` section padding, 4xl/5xl content width | 24 to 40px rhythm; 1200 / 720px caps | A working application needs calm density |
| Scroll-entry animation, staggered reveals, ambient gradient blob, hover card lift with shadow | None | Motion only on state changes, 120 to 200ms, off under reduced motion. No gradients or shadows at all apart from one overlay shadow at 5% opacity. |
| Hero imagery, photography, illustrations, faux-OS window chrome | None | Not an application concern |
| Fonts: SF Pro / Geist Sans; Newsreader among serifs; Geist Mono | Instrument Sans; Newsreader; Geist Mono | The brief asked for a characterful sans; SF Pro is not licensable for the web |
| Icons: Phosphor Bold/Fill or Radix | Inline sprite at Phosphor Bold weight + Phosphor Bold from CDN | Must work offline and from `file://` |
| Status colours named success, warning, danger | neutral, info, positive, caution, critical | UX architecture naming; "critical" is reserved for system faults |

---

## 10. Verification record (21 September 2026)

Verified:

- Contrast: all pairs above computed with a script, and recomputed by `components.html` in a browser in both themes; the two sets of numbers agree and no pair fails.
- `components.html` rendered in a Chromium browser pane over a local HTTP server: fonts and the Phosphor stylesheet loaded, no console errors, 60 sprite icons injected, 53 swatches rendered.
- Every class used in `components.html` and `ui.js` exists in `ui.css` (or in the page's own `sg-` styles); every `var(--token)` used in `ui.css` exists in `tokens.css`; all relative asset paths resolve; no duplicate ids; no dangling `href="#..."`, `aria-controls`, `aria-labelledby`, `aria-describedby`, `for` or `data-modal-open` references; every `#i-*` icon exists.
- No horizontal overflow at 320, 375, 800, 1100 and 1366px viewport widths.
- Layout at breakpoints by measurement: SideNav 256px at 1366, 72px rail at 800 with 53 × 56px items, hidden on phones; workspace two panes (flexible + 420px) at 1366 and one column at 1100; exam navigator 240px from lg; aside 320px from lg; table becomes cards at 375px and Select mode reveals checkboxes and the bulk bar.
- Target sizes by measurement: no navigation item, bottom tab, question-navigator item, sticky-bar button, section-switcher item, tab or pagination item under 44 × 44px.
- Dialogs: open, focus moves inside, Escape closes, focus returns to the trigger; the sheet is bottom-anchored and full width at 320px (verified by geometry; the screenshot tool does not capture the top layer).

Not verified:

- Opening by double-click from `file://` in a desktop browser. The browser pane available here renders local files as static snapshots without their linked CSS, so the page was served over `http://127.0.0.1` instead. Nothing in the page depends on a server: all paths are relative, there are no ES modules, no `fetch`, and the icon sprite is injected inline.
- Behaviour with the font and icon CDNs blocked (designed for, not exercised).
- Screen readers (NVDA, JAWS, VoiceOver), Windows High Contrast, 400% zoom, touch devices, Safari and Firefox.
- Visual review at desktop widths was limited by the pane's size; desktop checks were made by measurement and small screenshots, phone checks by full-size screenshots.
- Print output of the receipt.
- The wordmark as outlines (section 1.3).

---

## 11. Changes after prototyping and the accessibility audit (21 September 2026)

Building 23 screens on this system, and auditing them, found gaps and defects. These are now in `ui.css`; the component gallery has not yet been given specimens for the three new components.

**Components added**

| Component | Class | Why |
|---|---|---|
| Sub-navigation within one object | `.subnav`, `.subnav__item` | Cohort pages (Setup, People, Readiness, Moderation) needed it; `.section-switcher` is hidden from 1280px and is for panes, not pages |
| Meter | `.meter`, `.meter__bar`, `.meter--caution` | Held-result age against the maximum hold; `.progress` is for a task moving to completion, not a measured value. Always paired with visible text |
| Advisory conflict panel | `.conflict--advisory` | A role assignment that succeeds with a separation-of-duties advisory (decision U-01) must not look like a refusal. Uses `role="status"` |

**Still missing:** a number input with a unit ("14 days from release"); a button reset for `.bottom-tabs__item` so that "More" can be a real button; a session-expiry warning dialog (audit finding A11Y-07).

**Defects fixed**

| Fix | Audit ref |
|---|---|
| At a short or narrow viewport (high zoom) the exam action bar, section switcher, decision bar, action bar, and bulk bar stop being sticky, and the exam bar becomes one row. Sticky regions measured 296px of a 256px viewport at 400% zoom; they now take 61px in the exam and 56px in the workspaces | A11Y-02, A11Y-03 |
| The bulk bar feeds `scroll-padding-bottom`, so a focused row is not hidden under it | A11Y-04 |
| Buttons may wrap; only icon buttons stay on one line | A11Y-19 |
| Standalone links are 44px tall on phones | A11Y-20 |
| Row headers (`tbody th`) are styled, including in card mode, so tables can use real row headers | A11Y-10 (pattern only; pages not yet converted) |
| Forced-colours rules for the segmented control, filter chip, pagination, answered question, progress and chart bars, tag shapes | A11Y-13 (from CSS inspection; not yet rendered in a Windows contrast theme) |
| A hidden action or decision bar no longer hides the bottom tabs or reserves space | Builder report |
| Classed lists can keep their markers: `ol.prose`, `ul.prose`, `.list--numbered`, `.list--bulleted` | Builder report |
| The decision panel asks for "Days to resubmit", counted from release, not a calendar date, so a moderation hold cannot consume the learner's time (ADR-019) | Builder report |

**Rule for the real build:** measure sticky regions with a `ResizeObserver` and set the scroll padding from the measurement. Fixed height tokens are wrong as soon as text wraps under zoom, translation, or a long exam title.
