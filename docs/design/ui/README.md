# LMS UI Design

## Status

Status: **Proposed for design review**  
Date: 21 September 2026  
Deliverable: written specifications plus static HTML prototypes. There is no application code here, and nothing in the prototype folder is meant to be shipped.

The design follows the architecture package in the parent folder and SRS version 1.0. Where a screen depends on a working decision that an owner has not yet confirmed (the P-series in the [fixes and decisions register](../LMS-design-fixes-and-decisions.md)), the screen shows the working decision.

## Contents

1. [UX architecture](LMS-ux-architecture.md): design principles from the SRS, navigation for people who hold several roles, a sitemap per role with every functional requirement placed, the screen inventory, key flows, the status vocabulary, the exam-mode specification, responsive rules, microcopy, accessibility requirements, and open questions.
2. [Design system](LMS-design-system.md): the proposed Takusani brand, design tokens with measured contrast ratios, the status vocabulary mapped to tones, component specifications, layout, and how the tokens map to Tailwind CSS and an accessible component base for the Next.js build.
3. [Prototype](prototype/index.html): the 18 priority screens across all six roles, a [component gallery](prototype/components.html), and the shared stylesheet they are built on.

## Viewing the prototype

Serve the `prototype` folder over HTTP and open `index.html`:

```bash
python -m http.server 4173 --directory docs/design/ui/prototype
```

Then open `http://localhost:4173/`. Opening the files directly from disk also works in an ordinary browser. Fonts load from Google Fonts and fall back to system fonts when offline; the icons are inline and need no network.

Most screens have several states. The dashed "Prototype controls" box in the bottom corner switches between them and links back to the list of screens. That box, `assets/proto.js`, and `assets/proto.css` are prototype scaffolding and are not part of the design.

## Direction

Clean editorial minimal: a warm off-white canvas, off-black text, a serif for page titles and key figures, a sans for the interface, monospace for identifiers and timestamps, flat surfaces with one-pixel borders, almost no shadow, and colour used only to carry meaning. Accessibility took priority over the style's defaults: every text and background pair was measured against WCAG 2.2 AA, several default greys and pastel text colours were darkened, operable controls received a border that meets 3:1, and no status is carried by colour alone.

## Decisions that shape the screens

- **Unified navigation, no role switcher.** The side navigation is grouped by workspace and a group appears only for a role the person holds. Separation of duties applies per assessment, so one person may assess some work and moderate other work in the same week; a global "mode" would hide returned work.
- **The exam has its own shell with no navigation in it**, so the restriction on in-app navigation during an exam is structural.
- **A held result shows the learner one label, "Being assessed"**, from submission to release, so nothing hints at an outcome that moderation may change. Staff screens always show both the decided and the released date.
- **Deadlines are written as the last full day**, for example "until the end of Tuesday 29 September 2026", in South African Standard Time. A midnight time is never shown.
- **"Not yet competent" is an amber "action needed" state**, never red, and is always followed by what to do next.
- **Refusals name the conflict.** A separation-of-duties refusal names the decision that causes it; an excluded appeal reviewer is shown greyed with the reason in visible text.
- **Irreversible actions state their consequence** in plain words before they happen: releasing a cohort's results, finalising a decision, submitting an exam.

Two questions raised by this work were decided by the product owner on 21 September 2026 and are recorded in the register as U-01 (advise at role assignment, block at allocation) and U-02 (per-learner exam accommodations granted before the sitting).

## What has and has not been checked

Checked: every class used by a screen exists in the stylesheet; every link, icon, and id reference resolves; no hard-coded colours, placeholder text, or emoji; no horizontal scrolling at 375, 1100, and 1366 pixels in any state; exactly one visible main heading in every state; no console errors; contrast ratios computed for every token pair in both themes.

Not checked: screen readers, Windows contrast themes, real browser zoom (zoom was simulated by viewport size), Safari and Firefox, touch devices, printing of receipts, behaviour with the font service blocked, and any test with real learners. Desktop layouts were checked by measurement because the review browser could not show them at full size. The wordmark in `assets/logo.svg` is live text and must be outlined before use outside the application.

## Accessibility audit

The prototypes were audited against WCAG 2.2 AA on 21 September 2026: [LMS-ui-accessibility-audit.md](LMS-ui-accessibility-audit.md). It ran axe-core over about 95 page states in both themes and a manual pass ordered by risk, and found 24 issues: 2 blockers, 2 serious, 9 moderate, 11 minor. No screen reader was run, so what it says about speech output is inferred from markup. The report describes the prototypes as audited, before the fixes below.

| Finding | Status |
|---|---|
| A11Y-01 Blocker: exam could not be started or resumed in a window under 1024px, which a laptop reaches at 134% zoom | Fixed: the gate tests the input device, not width alone |
| A11Y-02 Blocker: at 400% zoom the exam's sticky bars covered the whole viewport | Fixed in the shared stylesheet; sticky regions now take 61px of 256px |
| A11Y-03 Serious: the same in the marking and moderation workspaces | Fixed in the shared stylesheet |
| A11Y-04 Serious: bulk-action bar hid the focused row | Fixed in the shared stylesheet |
| A11Y-05 Route to extra time nearly invisible | Fixed: its own section with a contact and a date to ask by; repeated on the learner home exam card |
| A11Y-06 Low-time label went stale | Fixed: "Less than 5 minutes left"; one string for the label and the accessible name |
| A11Y-08 No help line in exam mode | Fixed: in the navigator and on every notice panel |
| A11Y-09 "Mark" meant three things; "remark" read as "comment" | Fixed in the exam and on the learner appeal page |
| A11Y-13 Forced colours | Rules added from CSS inspection; not yet rendered in a contrast theme |
| A11Y-14, 15, 16, 17 (part), 19, 20, 22, 23 (part) | Fixed |
| A11Y-07 No session-expiry warning pattern | **Open.** Needs a dialog component and a specimen |
| A11Y-10 Tables have no row headers; card mode may lose table semantics | **Open.** Row-header styling is ready; pages not converted; card-mode semantics need a screen reader to settle |
| A11Y-11 Upload rows: state changes not announced | **Open** |
| A11Y-12 Scrollable regions a keyboard cannot scroll | **Open** |
| A11Y-18 Repeated identical disclosure labels | **Open** |
| A11Y-21 Disabled controls: reason placed after the control; excluded reviewers as disabled radios | **Open** |
| A11Y-24 Jargon and long sentences on learner screens | **Open**, apart from the items under A11Y-09 |

The audit's position on the exam timer and WCAG 2.2.1 is that the "essential" exception is defensible only if per-learner accommodations are built (decided, U-02), the session-expiry warning exists (open, A11Y-07), a paused upload states how long it waits, and the integrity overlay does not fire repeatedly for learners whose assistive software takes focus. Treat accommodations as a release blocker for exams.

## Next steps

1. Design review of the component gallery and the three walk-throughs on the prototype index.
2. Usability test of the exam flow and the result and appeal flow with learners of varying technical confidence, on their own devices and connections.
3. Answer the remaining open questions in section 12 of the UX architecture.
4. Port the tokens to the Next.js application as described in the design system's implementation mapping, and rebuild the components on an accessible headless base rather than porting the prototype markup.
