# Takusani LMS UI prototypes: accessibility audit

| | |
|---|---|
| Standard | WCAG 2.2 Level AA (AAA noted where the brief asked for it) |
| Audited | 23 prototype pages plus `components.html`, shared `assets/tokens.css`, `assets/ui.css`, `assets/ui.js` |
| Date | 21 September 2026 |
| Auditor | AccessibilityAuditor (automated scan, scripted geometry checks, keyboard pass, code review). No screen reader was run. See section 2.3. |
| Status of this document | Findings only. No prototype, CSS or JS file was changed. |

---

## 1. Summary

The prototypes are well above the usual standard for a first build. The markup is semantic, names and descriptions are wired correctly, status is never carried by colour alone, the dialogs trap and return focus, the timer is not a live region, and axe-core found almost nothing (four rule ids across about 95 page-state scans, none of them in the learner flows). That is the part automation can see. The problems that matter are the ones it cannot: **the exam is unusable for low-vision learners who zoom**, in two different ways, and the same sticky-region pattern breaks the marking workspace at high zoom. Both contradict commitments already written in UX architecture 8.1, 9.4 and 11.1, so they are implementation gaps, not design disagreements. Beyond those, the WCAG 2.2.1 position for the exam timer is defensible in principle but rests on product features that are still marked "assumption" in the design documents, and the route by which a learner asks for extra time is a single line of small grey text on a page most learners will first read on exam day. As it stands the prototype set **does not conform** to WCAG 2.2 AA (1.4.4, 1.4.10, 2.4.11, 2.1.1, 1.3.1 and 4.1.2 each have at least one failure); with findings A11Y-01 to A11Y-04 fixed it would be close, subject to the screen reader testing that this audit could not do.

**Findings by severity**

| Severity | Count | Meaning used here |
|---|---|---|
| Blocker | 2 | A group of users cannot complete a critical task at all |
| Serious | 2 | A major barrier on a P0 screen; workaround is unreasonable |
| Moderate | 9 | Real difficulty or a gap in a pattern the build will copy |
| Minor | 11 | Friction, robustness, wording |
| **Total** | **24** | |

**The three that matter most**

1. **A11Y-01**: below 1024 CSS px the pre-flight page removes "Start exam" and "Resume exam" and tells the learner that their laptop is a phone. A 1366 px laptop reaches that width at 134% browser zoom. There is no bypass on that page.
2. **A11Y-02**: at the WCAG reflow reference size (320 x 256 CSS px, which is 1280 x 1024 at 400%) the exam's two sticky bars are 123 px and 173 px tall, 296 px in a 256 px viewport. Every answer option is fully covered when it receives focus.
3. **A11Y-05**: the whole 2.2.1 "essential exception" argument depends on learners being able to get extra time before the sitting. The only place the prototype tells them how is `text-small text-muted` at the bottom of a card on the pre-flight page, with no link, no contact and no lead time.

---

## 2. Scope and method

### 2.1 What was tested

- All 23 pages listed on `index.html`, plus `components.html`. `assets/proto.js`, `assets/proto.css` and the "Prototype controls" panel were excluded (the panel was excluded from axe and removed or hidden in the geometry scripts).
- Design intent was read from `LMS-ux-architecture.md` sections 8 and 11 and `LMS-design-system.md` sections 2.1 to 2.6 only.
- Items the brief listed as already verified (token contrast, class existence, id and IDREF integrity, one visible `h1`, no overflow at 375/1100/1366, no console errors) were not repeated. axe's `color-contrast` rule ran as part of the scans and reported no violation in either theme on any sampled state, which is consistent with that earlier work.

### 2.2 How

| Pass | Tool and conditions | Coverage |
|---|---|---|
| Automated | axe-core 4.13.0 injected from jsDelivr, tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`. Engine: Chromium 152 (the Claude desktop Browser pane) on Windows 11. Each page state was loaded fresh in a same-origin iframe sized to the target viewport, so media queries applied. | About 95 page-state scans: every state of `sign-in`, `learn-home`, `learn-task`, `learn-result`, `learn-appeal-new`, `exam-receipt`, `exam-mobile-gate`, `moderate-signoff`, `admin-roles`; `exam-attempt` 7 of 8 (not `reconnected`); `learn-exam-preflight` 5 of 6 (not `not-open`); `notifications` 3 of 4 (not `released`); `assess-marking` 5 of 7; `coordinate-appeal-detail` 4 of 6; default or key states of the remaining pages; learner pages at 375 x 812, staff and exam pages at 1366 x 768, staff pages again at 375 x 812; 7 key states re-run with `data-theme="dark"`. |
| 2.4.11 Focus Not Obscured | Script: focus every visible focusable in turn (the browser scrolls it into view using the page's own `scroll-padding`), then sample five points of its box with `elementFromPoint` and record any that land on a `position: sticky` or `fixed` region. "Fully hidden" means 5 of 5. | About 50 page-state and viewport combinations: 1366 x 768, 1100 x 700, 640 x 512 (200% of 1280 x 1024), 375 x 667, 320 x 256 (400% of 1280 x 1024). |
| 1.4.10 Reflow, 1.4.12 Text Spacing, 1.4.4 Resize Text | Script: 320 px wide frames with and without the WCAG text-spacing overrides (`line-height 1.5`, `letter-spacing .12em`, `word-spacing .16em`, paragraph spacing 2em); detection of page-level horizontal scroll, clipped `overflow: hidden` boxes and truncating ellipses. 200% zoom simulated as a 683 x 384 and 640 x 512 viewport. A text-only 200% test (`html { font-size: 200% }` at 375 px) was run for information. | Learner and exam pages, `assess-marking`, `moderate-signoff`, `coordinate-appeal-detail`, `admin-roles`. |
| 2.5.8 Target Size | Script: every visible target under 24 x 24 CSS px, then the spacing exception (24 px circle) computed against all other targets. | Learner and exam pages at 375 px, exam at 1366 px. |
| Keyboard | Real `Tab`, `Shift+Tab` and `Escape` key presses through the pane, with a `focusin` logger. | `exam-attempt.html`: full tab order in the default state; focus on question change; integrity overlay (focus on open, trap, Escape, focus return); takeover screen (focus on open, what remains focusable); submit dialog (focus on open, Tab cycle, Escape, focus return). The `time-up`, `offline` and `reconnected` states were reviewed in code and scanned with axe, not driven by keyboard. Other pages had no real-key pass; their focus order was not walked by hand. |
| Code review | Read `ui.js`, `ui.css` in full, and the markup of `exam-attempt`, `learn-exam-preflight`, `exam-receipt`, `exam-mobile-gate`, `sign-in`, `learn-home`, `learn-task`, `learn-result`, `learn-appeal-new`, `notifications`, `assess-marking`; targeted reads of `moderate-signoff`, `coordinate-appeal-detail`, `admin-roles`. | ARIA patterns, live regions, modal, tabs, menus, forced-colors and reduced-motion rules, print rules. |
| Plain language | Manual read of learner and exam copy. | Section 3, A11Y-09, A11Y-16, A11Y-24. |

### 2.3 What was NOT tested, stated plainly

- **No screen reader was run.** Not NVDA, JAWS, VoiceOver, TalkBack or Narrator. Everything this report says about what a screen reader user hears is inferred from markup and from documented browser and AT behaviour. Unverified as a result: whether `role="timer"` with a changing `aria-label` stays silent in every AT; whether each `role="status"` and `role="alert"` region is actually spoken, once, in the right order; how the `alertdialog` overlays are read; virtual-cursor behaviour around `inert`; how `details`/`summary` menus are announced; how a disabled radio with `aria-label` plus `aria-describedby` is read in browse and focus modes; whether card-mode tables keep row and column semantics on iOS Safari and Android Chrome; whether `td::before { content: attr(data-label) }` is spoken.
- The browser pane exposes neither `Element.computedRole` nor the real accessibility tree, so computed roles and names could not be inspected directly.
- **One engine only** (Chromium). No Firefox, no Safari or WebKit, no real phone, no touch input, no TalkBack or VoiceOver gestures.
- **Forced colours / Windows High Contrast was not rendered.** A11Y-13 is from reading the CSS.
- **Real browser zoom and OS text scaling were not used.** Zoom was simulated by viewport size, which is equivalent for layout and media queries but not for Android font scaling or Windows text-size settings.
- The pane's synthetic key events carry no `KeyboardEvent.code` and do not trigger a button's default action, so `Enter`, `Space`, `Alt+N`, `Alt+P` and `Alt+T` could not be pressed for real. The shortcut handlers were exercised with dispatched `KeyboardEvent`s and buttons with `.click()`. `Tab`, `Shift+Tab` and `Escape` were real.
- Visual inspection was limited: the pane scales large viewports down and cannot crop, so judgements about what is visible rely on computed geometry and CSS, not on looking at pixels.
- The prototype does not implement fullscreen, focus-loss detection, copy and paste blocking, IndexedDB, a server clock or real offline handling. None of that behaviour could be tested; only the screens that represent it.
- Not tested at all: voice control (Dragon, Voice Access), switch access, screen magnifier software, print output, time-based media (1.2.x), uploaded documents and PDFs, and usability with disabled or second-language learners.

---

## 3. Findings

Ranked most severe first. "Shared" means one fix in `assets/` or in a copied pattern covers every page that uses it.

### A11Y-01 The exam cannot be started or resumed below 1024 CSS px, and that page has no zoom bypass

- **Severity**: Blocker
- **WCAG**: 1.4.4 Resize Text (AA); 1.4.10 Reflow (AA)
- **Where**: `learn-exam-preflight.html`, states `ready`, `accommodation`, `not-open`, `check-failed`, `resume`. Start card `div.card.u-hide-below-lg` (line 228), Resume wrapper `div.u-hide-below-lg` (line 108), device-check row `li.pf-narrow-only` (line 159), gate `div.pf-gate.pf-narrow-only` (lines 254 and 266), rule at line 20. Page-specific, but the real product will copy the logic.
- **Who and what they experience**: a low-vision learner who browses at 150% or 200% on the common 1366 x 768 laptop (CSS width 911 or 683 px), or anyone with a half-width browser window. "Start exam" is not on the page. In its place: "You need a laptop or desktop computer to sit this exam". The device check reports "Problem: this looks like a phone, a tablet or a small window". In the `resume` state the same thing happens **while the timer is running**. Nothing on the page says that zooming out would help. `exam-attempt.html` does offer "Carry on at this size" for fine-pointer devices; pre-flight, which comes first, does not, so the learner never gets that far.
- **Evidence**: at 683 x 384 and at 1023 x 600, visible start or resume controls = none; gate heading visible; `matchMedia('(hover: hover) and (pointer: fine)')` = true. The breakpoint is `min-width: 64rem`, so a 1366 px screen crosses it at 134% zoom. UX architecture 8.1 and 9.4 already require that "the mobile gate tests the device, not only the width".
- **Fix** (`learn-exam-preflight.html`):
  1. Replace `u-hide-below-lg` on lines 108 and 228 with a page class, for example `pf-desktop-only`, and change the page rules to gate on the input device as well as width:
     ```css
     .pf-narrow-only { display: none !important; }
     @media (max-width: 63.99rem) and (hover: none), (max-width: 63.99rem) and (pointer: coarse) {
       .pf-narrow-only { display: revert !important; }
       .pf-desktop-only { display: none !important; }
     }
     ```
  2. For narrow plus fine pointer, show the pass row with a plain note: "This window is narrow. If you have zoomed in so that you can read more easily, that is fine. The exam works at this size."
  3. Real build: decide "handheld" from `navigator.userAgentData.mobile`, pointer and hover media features, never from width alone, and make the server-side device rule agree with it.
- **Verify**: at 1366 x 768 and 200% browser zoom, a keyboard user can tick the acknowledgement and activate "Start exam"; in `resume`, "Resume exam" is reachable.

### A11Y-02 At 400% zoom the exam's sticky bars cover the whole viewport

- **Severity**: Blocker
- **WCAG**: 1.4.10 Reflow (AA); 2.4.11 Focus Not Obscured (Minimum) (AA)
- **Where**: shared, `assets/ui.css` `.exam-shell__bar` (line 746), `.exam-bar` (758, `flex-wrap: wrap`), `.exam-shell__actions` (751, `flex-wrap: wrap`), and the `--sticky-top` / `--sticky-bottom` variables (lines 19 to 26). Seen in `exam-attempt.html`, all answering states.
- **Who and what they experience**: a low-vision learner at 400% on a 1280 x 1024 screen (320 x 256 CSS px; a 1366 x 768 laptop at 400% is smaller still, 341 x 192). After choosing "Carry on at this size" the top bar wraps to four rows and the action bar to three. They overlap. The question, the answers and the question list scroll underneath and never appear. The timer keeps running.
- **Evidence**: measured at 320 x 256: `.exam-shell__bar` 123 px, `.exam-shell__actions` 173 px, free height -40 px. Focus check: 14 of 17 focusable controls fully hidden (5 of 5 sample points), including all five answer options of question 3 and all six navigator buttons, each covered by `.exam-shell__actions`. At 320 x 640 the free height is 344 px; at 640 x 512 (200%) nothing is hidden, but the bar is 93 px against a fixed `scroll-padding-top` of 72 px, so partial cover is possible. The navigator `details` is `open` by default and 541 px tall at this width, so the question also starts below the fold.
- **Fix** (`assets/ui.css`, section 12):
  ```css
  @media (max-height: 30rem), (max-width: 47.99rem) {
    .exam-shell__actions { position: static; }
    .exam-bar { flex-wrap: nowrap; min-height: 2.75rem; }
    .exam-bar__title, .exam-bar__position { display: none; }   /* both are repeated in .question__number and <title> */
    .exam-bar .status-line { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; min-width: 0; flex: 1 1 0; }
    html:has(.exam-shell) { --sticky-top: 2.75rem; --sticky-bottom: 0px; }
  }
  ```
  Keep the timer visible; let everything else scroll. In `exam-attempt.html`, remove `open` from `details#navigator` when `matchMedia('(max-width: 63.99rem)')` matches. In the real build, set `--sticky-top` and `--sticky-bottom` from a `ResizeObserver` on the sticky regions instead of from fixed tokens, because both bars change height with zoom, language and the shortened-attempt text.
- **Verify**: at 320 x 256, Tab through the page; every focused control is at least partly visible and the question stem can be read without the bars covering it.

### A11Y-03 Marking and moderation workspaces: sticky regions cover the content at 400% zoom

- **Severity**: Serious
- **WCAG**: 2.4.11 Focus Not Obscured (Minimum) (AA); 1.4.10 Reflow (AA)
- **Where**: shared, `assets/ui.css` `.section-switcher` (line 683), `.decision-bar` (line 172), `.app-shell__topbar` (line 105). Seen in `assess-marking.html` and `moderate-item.html`.
- **Who**: low-vision assessors and moderators in long desktop sessions at high zoom.
- **Evidence**: at 320 x 256, `assess-marking.html#state=draft`: top bar 56 + switcher 48 + decision bar 164 = 268 px; 31 of 36 focusable controls fully hidden. `moderate-item.html#state=review`: decision bar 188 px; 20 of 25 fully hidden. At 375 x 667 the decision bar is 118 to 142 px and nothing is fully hidden. At 1366 x 768 and 1100 x 700 there are no full hides (tall textareas are partly covered by the decision bar, which passes AA and would fail 2.4.12 AAA).
- **Fix** (`assets/ui.css`): in the same `@media (max-height: 30rem)` block as A11Y-02, set `.section-switcher, .decision-bar, .action-bar, .bulk-bar { position: static; }` and `html { --sticky-bottom: 0px; }`. Keep only the 56 px top bar sticky.

### A11Y-04 The bulk-action bar hides the focused row control

- **Severity**: Serious
- **WCAG**: 2.4.11 Focus Not Obscured (Minimum) (AA)
- **Where**: shared, `assets/ui.css` `.bulk-bar` (line 490). Seen in `teach-submissions.html#state=selected` and `components.html`.
- **Who and what they experience**: a keyboard-only facilitator who has selected rows and tabs on to the next row. The row checkbox and the "History for ..." button are scrolled to just above the bottom edge, exactly under the bar. The user cannot see which learner they are about to add to a bulk reminder.
- **Evidence**: 1366 x 768: row checkbox (top 711, bottom 735) and `button "History for Imraan Davids"` (706 to 742) are 5 of 5 hidden by `.bulk-bar` (68 px tall, offset 12 px). 375 x 667: the select-mode checkbox is 5 of 5 hidden by the 124 px bar. `--sticky-bottom` takes `.action-bar`, `.decision-bar`, `.exam-shell__actions` and `.bottom-tabs` into account (lines 22 to 25) but not `.bulk-bar`.
- **Fix** (`assets/ui.css`, after line 25):
  ```css
  html:has(.bulk-bar:not([hidden])) { scroll-padding-bottom: calc(var(--sticky-bottom) + 6rem); }
  @media (max-width: 47.99rem) { html:has(.is-selecting ~ .bulk-bar:not([hidden])) { scroll-padding-bottom: calc(var(--sticky-bottom) + 9.5rem); } }
  ```
  or measure the bar at run time as in A11Y-02.

### A11Y-05 The route to extra time is nearly invisible, and the 2.2.1 position depends on it

- **Severity**: Moderate (it becomes Serious if the accommodation feature is not built; see section 4)
- **WCAG**: 2.2.1 Timing Adjustable (A), as the condition for relying on the "essential" exception; 3.3.2 Labels or Instructions (A) in spirit
- **Where**: `learn-exam-preflight.html` line 153: `<p class="text-small text-muted u-mt-4">Do you need more time, or do you use assistive software ... Ask your coordinator before the exam day.</p>`. Nothing on `learn-home.html` (Exam card), on `exam-mobile-gate.html`, or in any notification.
- **Who**: learners who need extra time or who use a screen reader, magnifier, speech-to-text or an on-screen keyboard; learners with low technical confidence who open this page for the first time on the day.
- **What they experience**: the one sentence that protects them is the smallest, greyest text in its section, has no link and no contact, gives no lead time, and sits on a page whose lead paragraph says "Read this page before you start". By then it is too late: "Extra time can only be arranged before you start."
- **Fix**: on `learn-exam-preflight.html`, promote it to its own `h2` section, "If you need more time or use assistive software", in body text, with the coordinator's name, a contact link and a date ("Ask by Wednesday 7 October 2026"). Repeat one line with a link in the `learn-home.html` Exam card and in the exam-scheduled notification. Do not ask the learner to describe a disability in a free-text field that staff across roles can read (POPIA special personal information).

### A11Y-06 The low-time label goes stale and disagrees with the timer's accessible name

- **Severity**: Moderate
- **WCAG**: no single criterion fails; it undermines the low-time warning that 1.4.1 and 2.2.1 rely on. Cognitive and second-language impact.
- **Where**: `exam-attempt.html` script line 443: `timerLabel.textContent = ... r <= 60 ? '1 minute left' : r <= 300 ? '5 minutes left' : r <= 900 ? '15 minutes left' : 'Time left'`.
- **Evidence**: in `#state=low-time`, two seconds in: visible text "5 minutes left 04:58", `aria-label="Time left: 4 minutes"`. At 01:30 remaining the box reads "5 minutes left 01:30"; at 07:00 it reads "15 minutes left 07:00".
- **Who**: every learner under time pressure; worst for second-language readers and anxious learners, who see two numbers that disagree. A screen reader user hears a third version.
- **Fix**: use threshold wording that stays true: "Less than 15 minutes left", "Less than 5 minutes left", "Less than 1 minute left". Build the `aria-label` from the same string plus the spoken value. Update UX architecture 8.3 and the `.timer` comment in `ui.css`.

### A11Y-07 No session-expiry warning pattern exists anywhere in the prototype

- **Severity**: Moderate
- **WCAG**: 2.2.1 Timing Adjustable (A)
- **Where**: gap. `sign-in.html#state=expired` shows the result ("You were signed out for security"); no page and no component in `components.html` shows the warning that UX architecture 11.1 requires ("Warn at least two minutes before session expiry with an option to extend").
- **Who**: assessors writing long justifications, learners writing appeal grounds on a phone, anyone slow with a keyboard or a screen reader.
- **Why it matters here**: section 11.2 limits the "essential" exception to the exam timer. Every other timer must then be adjustable, and the session timer is the one every user meets. If the pattern is not in the gallery it will not be built.
- **Fix**: add to `components.html` and `ui.js` a `dialog.modal` with `role="alertdialog"`: "You will be signed out in 2 minutes because you have not done anything for a while. Your draft is saved." Buttons: "Stay signed in" (default focus) and "Sign out". At least 20 seconds to respond, extendable at least ten times, and a focus return to where the user was. State on the exam pre-flight page that an active attempt never signs the learner out.

### A11Y-08 Exam mode has no help line

- **Severity**: Moderate
- **WCAG**: 3.2.6 Consistent Help (A) as intended by UX architecture 11.1. The criterion is not strictly failed by a page with no help, but the design's own requirement is unmet.
- **Where**: `exam-attempt.html`, every state including the integrity overlay, the takeover screen and "Time is up". `grep -i "invigilator|Problem?"` returns no match.
- **Who**: learners with low technical confidence, and any learner whose assistive software fails in the middle of an attempt that cannot be paused.
- **Fix**: add the fixed line from UX 11.1, "Problem? Tell your invigilator or coordinator.", to the navigator panel under the keyboard hint, and to each `.exam-notice__panel`. Plain text, no link out of the exam.

### A11Y-09 "Mark" means three things in the exam, and "remark" reads as "comment"

- **Severity**: Moderate
- **WCAG**: 3.1.3 Unusual Words and 3.1.5 Reading Level are AAA; this is a requirement of UX architecture 10.1 (plain language for second-language readers) and of 3.2.4 Consistent Identification (AA) in spirit.
- **Where**: `exam-attempt.html`: "4 marks" (points), "Mark to come back to" / "marked to come back to" (bookmark), and UX 8.5's threshold text "Your attempt has been marked so that your assessor looks at this record" (flagged). `learn-appeal-new.html`: "See my marked script", "Ask for a remark", "A remark can move your mark up or down". Staff pages spell it "re-mark".
- **Who**: second-language readers, under time pressure in the exam and at a rights-bearing moment in the appeal. "Ask for a remark" most naturally means "ask for a comment".
- **Fix**: keep "marks" for points only. Exam: "Come back to this later" for the button, state text "To come back to", accessible name "Question 5, not answered, to come back to". Integrity text: "Your assessor has been asked to look at this record." Appeal: "Ask for your work to be marked again" and "See my work with the marks", or at minimum "re-mark" with the hyphen everywhere.

### A11Y-10 Data tables have no row headers, and the phone card layout risks losing table semantics

- **Severity**: Moderate
- **WCAG**: 1.3.1 Info and Relationships (A)
- **Where**: shared. Markup pattern `<td class="table__primary-cell">` on 14 pages (for example the criterion column in `learn-result.html`, the work column in `learn-home.html`); only 10 `<th scope="row">` in the whole set. CSS `assets/ui.css` lines 462 to 480: below 768 px, `.table--cards`, its `tbody`, `tr` and `td` become `display: block` or `grid`, `thead` is visually hidden, and labels come from `td::before { content: attr(data-label) }`.
- **Who**: screen reader users on phones, which is the main learner platform.
- **What they experience**: moving down the Mark column on the result page, a screen reader announces "Mark, 2 of 4" but not which criterion, because no cell is a row header. In card mode, Chromium keeps table semantics when `display` is overridden and WebKit historically has not; where they are lost, the visually hidden header row is read as four loose words before the data, and the only column association left is the generated `data-label` text. Some `data-label` values differ from the real header ("Looks for" and "What your assessor looks for"; "Comment" and "Assessor's comment"; "Deadline" and "Deadline (SAST)").
- **Evidence**: markup and CSS as cited. The accessibility tree could not be inspected (section 2.3), so the card-mode part is a risk to verify with VoiceOver on iOS and TalkBack, not a measured failure. The missing row headers are a failure at every width.
- **Fix**: make the first cell `<th scope="row" class="table__primary-cell">` and add `tbody th` wherever `ui.css` styles `.table td` and `.table--cards td`. For card mode either add explicit roles to the pattern (`role="table"`, `rowgroup`, `row`, `columnheader`, `rowheader`, `cell`) so the CSS cannot remove them, or, in the React build, render a list of cards with a `dl` per card below `md` instead of restyling a table. Make every `data-label` match its header.

### A11Y-11 Upload rows: changes of state have no announcement pattern, and the file inputs do not name their requirement

- **Severity**: Moderate
- **WCAG**: 4.1.3 Status Messages (AA); 3.3.1 Error Identification (A) for rejected files; 2.4.6 Headings and Labels (AA)
- **Where**: `learn-task.html`, states `uploading` and `returned`; pattern `.upload`, `.upload-row` in `ui.css` and `components.html`.
- **What is there**: one `span.status-line[role=status]` ("2 of 5 files uploaded. Keep this page open.") and a `role="progressbar"` per row with `aria-valuenow` and a name that includes the state. That is good. What is missing: no live semantics for a row becoming "Not accepted", "Expired" or "Paused", which are the three states a learner must act on; UX 11.3 lists progress, pause, resume and completion but not rejection or expiry. Both file inputs are named only "Choose a file" and "Choose files"; the requirement title (`p.upload__title`) is not associated with them.
- **Who**: a screen reader user on an unreliable connection. The file they chose is rejected for size, the visible row turns red with a clear message, and they hear nothing. Tabbing, they hear "Choose files" twice with no way to tell requirement 1 from requirement 2.
- **Fix**: give each `p.upload__title` an `id` and put `aria-describedby="<that id>"` on the matching `input.upload__input`. Add one `role="alert"` region per upload list for "not accepted" and "expired" (one sentence: file name, reason, what to do) and route "paused" and "resumed" through the existing `role="status"` line. Add rejection and expiry to the table in UX architecture 11.3. State how long a paused upload lasts before it expires; see section 4, condition 4.

### A11Y-12 Scrollable regions that a keyboard cannot scroll

- **Severity**: Moderate
- **WCAG**: 2.1.1 Keyboard (A)
- **Where**: `.workspace__panel` (`ui.css` line 692: sticky, `max-height`, `overflow-y: auto`) in `assess-marking.html#state=held` and `#state=released`, where the page script sets every rubric input to `disabled`, leaving the panel with nothing focusable. `.table-wrap` in `admin-configuration-key.html#state=invalid`. Both shared patterns.
- **Evidence**: axe `scrollable-region-focusable`, impact serious, one node on each page.
- **Who**: keyboard-only assessors reading a finalised decision, and sighted keyboard users in Safari. Recent Chromium and Firefox make such scrollers focusable by default; Safari does not.
- **Fix**: add `tabindex="0" role="region" aria-label="Rubric, feedback and decision"` to `.workspace__panel` in `assess-marking.html` and `moderate-item.html`. For any `.table-wrap` that can overflow, add `tabindex="0" role="region" aria-labelledby="<caption id>"`, as `components.html` already does for the status vocabulary table. Better, in read-only states render the rubric as a text record (as the decision record already is) instead of a disabled form, so scores keep full contrast and stay readable in reading order.

### A11Y-13 Forced colours: some selected states vanish and some bars can disappear

- **Severity**: Moderate. From CSS inspection only; not rendered.
- **WCAG**: 1.4.1 Use of Color (A); 1.4.11 Non-text Contrast (AA), for users of Windows contrast themes
- **Where**: shared, `assets/ui.css` lines 961 to 964 and the rules named below.
- **Evidence**:
  - `.segmented__option input:checked + span` (line 267) marks the selected option with background, inset `box-shadow` and weight. The radio is `opacity: 0`. In forced colours the background is reset and box-shadows are removed, leaving only 600 against 500 weight to show which of Light, Dark, System is chosen.
  - `.filter-chip[aria-pressed="true"]` (line 488): pressed state is background and text colour only.
  - `.pagination__item` (line 284) has `border: 1px solid transparent`. Transparent borders become visible in forced colours, so every page link gets a border and the current page is no longer distinct.
  - `.progress__bar` and `.bar-chart__bar` have `forced-color-adjust: none` and keep `background: var(--color-text-strong)` (`#111110` in the light theme). On a dark contrast theme with the app in its light theme that is about 1:1 against Canvas. Upload progress also has text, so meaning survives; the bar does not.
  - `.tag::before` keeps author tone colours on a system Canvas: about 2.6:1 to 3.0:1 for the light-theme tones on black. The tag text still carries the meaning.
  - `.qnav__item.is-answered` loses its fill; the check glyph survives.
- **Fix** (`assets/ui.css`, inside `@media (forced-colors: active)`):
  ```css
  .segmented__option input:checked + span, .filter-chip[aria-pressed="true"],
  .pagination__item[aria-current="page"], .qnav__item.is-answered,
  .calendar__day--today .calendar__date { forced-color-adjust: none; background: Highlight; color: HighlightText; }
  .pagination__item { border-color: Canvas; }
  .progress__bar, .bar-chart__bar, .credits__segment--earned, .notification__unread { forced-color-adjust: none; background: Highlight; }
  .tag::before { color: CanvasText; }
  ```
  Then test in Windows 11 "Night sky" and "Desert" contrast themes with the app in both of its own themes.

### A11Y-14 Disabled pagination arrows have no role and no name

- **Severity**: Minor
- **WCAG**: 4.1.2 Name, Role, Value (A)
- **Where**: shared pattern. `a.pagination__item[aria-disabled="true"][aria-label="Previous page"]` with no `href`, in `notifications.html` (line 146), `coordinate-appeals.html` (lines 202 and 204), `teach-submissions.html`, `components.html` (line 535).
- **Evidence**: axe `aria-prohibited-attr`, impact serious. An `a` without `href` has the generic role, on which `aria-label` is prohibited and generally ignored.
- **Fix**: `<span class="pagination__item" role="link" aria-disabled="true" aria-label="Previous page">`, or `<button type="button" class="pagination__item" disabled aria-label="Previous page">`.

### A11Y-15 `role="alert"` plus a focus move speaks twice, and the exam's offline alert is long and assertive

- **Severity**: Minor
- **WCAG**: 4.1.3 Status Messages (AA), quality of implementation
- **Where**: conflict panels and error summaries that are `role="alert"` and also receive focus (`data-proto-focus`): `admin-roles.html` (lines 86 and 120), `coordinate-appeal-detail.html` (line 256), the same pattern in `coordinate-moderation`, `coordinate-cohort-setup`, `admin-configuration-key`, and `.error-summary`. Exam: `div.banner--offline[role="alert"]` in `exam-attempt.html` (line 71) holds about 70 words.
- **Who**: screen reader users. The inserted alert starts to read in full, the focus move cuts it off and starts again. In the exam, a 70-word assertive message interrupts a learner in the middle of a sentence, against the "polite, once" rule in UX 8.4 and 11.3. Separately, regions revealed by removing `hidden`, as the prototype does, are announced less reliably than regions whose text is injected.
- **Fix**: where focus moves to the panel heading, remove `role="alert"` from the container and use `role="group"` with `aria-labelledby`; the focus move is the announcement. `admin-roles.html` already uses `role="status"` for the advisory and an alert for refusals; keep that distinction through the heading text. Exam offline: announce one sentence through `#xm-announce` ("No connection. Your answers are being kept on this device. The timer is still running.") and make the visible banner `role="region"` with a label. Keep `role="alert"` only for "cannot keep a safety copy". In the build, always inject text into live regions that already exist.

### A11Y-16 The integrity overlay states a cause and shows a running tally

- **Severity**: Minor (wording)
- **WCAG**: none directly; UX architecture 8.5 ("do not guess at intent") and 8.8
- **Where**: `exam-attempt.html` `#xm-integrity`: heading "You left the exam window at 10:42"; body "This has been recorded (2 so far)."
- **Who**: learners using a screen reader, magnifier, on-screen keyboard or speech toolbar, whose software takes focus without the learner doing anything; any learner hit by an operating system pop-up. "You left" tells them they did something they did not do. "(2 so far)" reads as strikes towards a limit the design deliberately hides. The receipt page handles this well ("If something outside your control caused them, for example a pop-up from another program ..."); the overlay, which is where the anxiety happens, does not.
- **Fix**: heading "The exam window was not in front at 10:42". Body: "This can happen by accident, for example when another program shows a message. It has been recorded, and your assessor will decide whether it matters. It does not end your exam." Drop "(2 so far)" or move the count to the receipt. For learners with the accommodation flag, decide whether the overlay should appear at all; see section 4, condition 7.

### A11Y-17 Exam notice screens and parts of the navigator sit outside landmarks

- **Severity**: Minor
- **WCAG**: best practice supporting 1.3.1 and 2.4.1
- **Where**: `exam-attempt.html`: `#state=lease-lost` and the in-page `.xm-gate` have no `main` (axe `landmark-one-main`; axe `region`, 5 nodes, when the gate shows). `ul.qnav__key` and the keyboard hint are outside any landmark (axe `region`, 2 nodes) because `details#navigator` is not one. `footer#actions` is a `contentinfo` landmark named "Question actions".
- **Fix**: wrap the takeover panel and the gate panel in `<main>`. Give the navigator `role="region" aria-label="Questions"` on the `details`, or wrap it in an `aside` with a label. Change `footer.exam-shell__actions` to `<div role="group" aria-label="Question actions">`.

### A11Y-18 Six identical "How you were told" disclosures in a row

- **Severity**: Minor
- **WCAG**: 2.4.6 Headings and Labels (AA)
- **Where**: `notifications.html`, every `.notification`; pattern `.delivery-evidence > summary`.
- **Who**: screen reader and voice control users. Tabbing gives "How you were told, collapsed" six or more times with nothing to tell them apart.
- **Fix**: `<summary>How you were told<span class="u-visually-hidden"> about: Your result for Task 3 is ready</span></summary>`.

### A11Y-19 Long buttons cannot wrap: horizontal scroll at 320 px once text spacing is applied

- **Severity**: Minor
- **WCAG**: 1.4.12 Text Spacing (AA) in combination with 1.4.10 Reflow (AA). Each passes on its own: no clipping with spacing at 375 px or 1366 px, and no horizontal scroll at 320 px without spacing.
- **Where**: shared, `.btn { white-space: nowrap }` (`ui.css` line 292).
- **Evidence**: 320 px plus WCAG text spacing: `learn-home.html` page width 349 px ("View your result and feedback"), `learn-result.html` 340 px ("Start your resubmission"), `learn-exam-preflight.html` 332 px ("What you need for the exam"). The same rule will bite with any longer translation.
- **Fix**: `.btn { white-space: normal; text-align: center; padding-block: var(--space-2); }`. `min-height` already protects the target size. Keep `nowrap` only on `.btn--icon`.

### A11Y-20 Standalone links on phones are 18 to 22 px tall, including "Appeal this result"

- **Severity**: Minor
- **WCAG**: 2.5.8 Target Size (Minimum) (AA) passes. Every one of them clears the 24 px spacing exception (nearest other target 34 to 661 px away) or is inline in a sentence. They miss the project's own rule in UX 11.1 (44 px for primary actions and navigation on phones).
- **Where** (375 px): `learn-result.html` "Appeal this result" 120 x 19, the only entry to a time-limited right, set as an inline link at the end of `.deadline-line`; `learn-home.html` "All results" 63 x 21, "All tasks" 53 x 21, "Open calendar" 94 x 21, "Credits record" 92 x 21; `learn-appeal-new.html` "See the result and feedback" 178 x 21; `sign-in.html` "Forgot your password?" 147 x 18, "Help with signing in" 125 x 22.
- **Who**: learners with tremor or limited dexterity, and anyone on a small or cracked phone screen.
- **Fix**: on `learn-result.html` make the appeal action `<a class="btn btn--secondary">` on its own line under the deadline sentence. Give section-header and card-header links `class="link link--standalone"` with `min-height: 2.75rem` below `md`.

### A11Y-21 Disabled-control patterns: the reason comes after the control, and excluded people are disabled radios

- **Severity**: Minor
- **WCAG**: 1.3.2 Meaningful Sequence (A) and 4.1.2 (A) are met; this is about robustness.
- **Where**: `moderate-signoff.html` lines 260 to 263: three disabled controls and then `p#so-blocked`. The same order in `learn-task.html` (`#submit-blocked`), `learn-exam-preflight.html` (`#pf-blocked-open`, `#pf-blocked-check`) and `sign-in.html#state=locked`. `coordinate-appeal-detail.html` lines 183, 184, 276, 277: excluded reviewers are `<input type="radio" disabled aria-label="Bongani Sithole, cannot be chosen" aria-describedby="ex-2">` inside `div.candidate.is-excluded`.
- **Assessment**: the brief asked whether the disabled rows and their reasons can be perceived. Sighted keyboard users: yes. The reason is visible text in full-contrast `--color-text` and the row is not hidden; it is simply skipped by Tab, which is correct. Screen reader users in browse mode: yes, by inference. The "Cannot be chosen" `h3` is reachable by heading navigation and the reason is ordinary text after the name. Screen reader users arrowing through the radio group in focus or forms mode: no. Disabled radios are skipped, so the excluded people are never mentioned until the user leaves the group. `aria-describedby` on a control that cannot take focus is rarely spoken, and the name is likely to be read twice, once from `aria-label` and once from the visible span. The sign-off reason is correctly associated and is also stated by the alert banner at the top of the page, but in reading order it comes after the three dead controls it explains.
- **Fix**: put each `.blocked-reason` before the disabled controls in the DOM. Render "Cannot be chosen" as a plain `<ul>` of name, role tag and reason with no `input` at all, and extend the fieldset legend: "Choose a reviewer. 2 people cannot be chosen; they are listed after the options with the reason."

### A11Y-22 The email address is not carried from sign-in to "Reset your password"

- **Severity**: Minor
- **WCAG**: 3.3.7 Redundant Entry (A). It is arguable whether reset is "the same process"; the fix is cheap either way.
- **Where**: `sign-in.html`: from `#state=wrong` or `#state=locked`, where the address is known and shown, to `#state=forgot`, where `input#email-f` is empty.
- **Fix**: pre-fill `#email-f` with the address already entered.
- **3.3.8 Accessible Authentication (Minimum) (AA)**: passes as drawn. `autocomplete="username"` and `"current-password"`, no paste blocking, a "Show password" checkbox, no CAPTCHA, a lockout that is time-based and not a puzzle, and a reset link by email. The build must keep it that way; see section 7.

### A11Y-23 Smaller items in exam mode

- **Severity**: Minor
- **Where and fix**:
  - `details#navigator` is `open` by default at every width. Below `lg` it puts 468 to 541 px of navigator in front of the question on first load. Open it by default only from `lg`.
  - While the integrity and time-up overlays are open, `#exam` is `inert` but the three `.skip-link` elements before it are not. Tab cannot reach them because the trap works, but a screen reader's virtual cursor can, and they point into inert content (axe reports `skip-link` as incomplete, 3 nodes). Set `hidden` on them, or make all of `.xm-app` inert except the overlay.
  - Takeover screen: first focus lands on "Continue here instead", the action that disables the other tab. Follow the consequence-dialog convention and focus the `h1` (`tabindex="-1"`) so that a reflexive Enter does nothing.
  - Shortcuts test `e.code` only (`KeyN`, `KeyP`, `KeyT`). Some on-screen keyboards and remote-input tools send events with no `code`; this audit's own tool did. Fall back to `e.key.toLowerCase()`. On macOS, Option+N, Option+P and Option+T type characters, and the handler's `preventDefault` swallows them inside a textarea; document that or choose Ctrl+Alt there.
  - `p.question__notice[role="status"]` is static text. Revealed on each change to questions 5 and 6, it may be re-announced. Remove the role while the text is static and keep it for the moment a paste is actually blocked.
  - `Alt+T` speaks through a visually hidden region. A sighted keyboard user sees nothing happen. Acceptable, but the hint "hear the time left" should say that this is for screen readers.

### A11Y-24 Jargon, idiom and long sentences on learner and exam screens

- **Severity**: Minor
- **WCAG**: 3.1.5 Reading Level (AAA), advisory; UX architecture 10.1
- **Instances**:
  - "server" in wording that UX 8.4 fixes: "Not saved to the server", "the answers already saved to the server are the ones that count". Suggest "Not saved online yet. Your answers are being kept on this computer."
  - "released" and "ready" are used for the same event ("when your result is ready" and "when your result is released"; "Released on 22 September"). Choose "ready" for learners, and define "released" once where a date depends on it.
  - "late flag" (`learn-task.html`): "flag" is reserved for integrity by the design system and is an idiom. Use "Your assessor will see the word Late on this version."
  - "Lodge an appeal", "lodging": formal register. If it is the policy's own term, gloss it on first use: "Appeal (lodge an appeal)". The buttons can simply say "Send appeal".
  - "criterion" and "criteria", "AC 3.2", "summative", "NQF Level 4": programme vocabulary. Keep it, but do not rely on it alone; the result page already does this well ("Some criteria still need evidence" followed by a plain list of what to add).
  - Long sentences: the "We have your work" banner (`learn-home`, `learn-task`, `learn-result`, `exam-receipt`) opens with 37 words and closes with 27. Split it: "A second person, called a moderator, checks results before anyone sees them. Everyone's results for the same task come out together. We will message you here and by email. Your 7 days to appeal start on the day you get your result."
  - "Resubmission open", "resubmission period": heavy nouns. "You can resubmit" is already used elsewhere and is clearer.
- **"Not yet competent"**: handled with care and worth protecting. Caution tone and never critical, a diamond shape plus the words, the outcome repeated in a sentence ("Total: 5 of 8. Outcome: Not yet competent."), and the next step always directly underneath ("Here is what to do next"), with a date and a button. No change recommended.

---

## 4. Exam timer and WCAG 2.2.1

**The design position** (UX 11.2): the limit is essential; the learner cannot extend it; extra time is granted per learner by the coordinator before the sitting and folded into `expires_at`; warnings are polite status messages; the exception is relied on for the exam timer and window only.

**Assessment: defensible at Level AA, conditionally.** 2.2.1 allows a time limit that is "essential" where "extending it would invalidate the activity", and a timed summative assessment is the standard example of that reasoning. But the exception does not mean "a timer exists, so we are exempt". It holds only while all of the following are true, and several are not yet true of the product:

1. **The limit really is part of assessment validity.** The institution's assessment policy, not the LMS team, must state that duration is a condition of this assessment. If an exam's time limit is administrative (to fit a room booking), the exception does not apply to that exam and the limit should be generous or adjustable. This should be a per-exam setting that a coordinator confirms.
2. **The accommodation exists in the product.** UX 11.2 point 3 and 8.8 mark per-learner extra time, paste permission and the assistive-software flag as "assumption; section 12, Q5". The prototype shows them working (`learn-exam-preflight.html#state=accommodation`, `assess-marking.html#state=exam`), and shows them well: the learner sees their own duration and window and the assessor sees the snapshot. If Q5 is answered "later", the essential-exception claim collapses into "disabled learners get the same time as everyone else with no mechanism", which is a 2.2.1 failure for the people the criterion exists to protect. **Treat Q5 as a release blocker for exams.**
3. **Learners can find and use the route in time.** See A11Y-05. The route must be visible at enrolment and when an exam is scheduled, with a date to ask by and a named person. The request must not require a learner to put health information where assessors or facilitators can read it.
4. **The exception is not stretched.** Everything else with a clock must meet 2.2.1 in the ordinary way:
   - session expiry: warn and extend (A11Y-07, currently missing);
   - toasts: 6 seconds, paused on hover and focus, content also on the page (fine as implemented in `ui.js`);
   - **resumable upload expiry**: `learn-task.html` shows "Expired. This upload was paused for too long. Choose the file again." That is a time limit that loses the learner's work, on the platform's least reliable connections. Either make it 20 hours or more (the 2.2.1 exception), or state the period in the paused row ("It will wait until 17:00 tomorrow") and warn before it lapses;
   - the 15-minute sign-in lockout and the 7-day appeal window are outside 2.2.1 (a security pause; more than 20 hours).
5. **The interface does not spend the learner's time.** Warnings are non-modal: met. The integrity overlay is modal while the timer runs, so it must be dismissible with a single key press, and it is: focus lands on "Return to the exam", the trap works, and focus returns to the control the learner was on (verified). The attempt must not start until fullscreen succeeds; the pre-flight copy says so and the build must honour it. Once A11Y-02 is fixed, zoom does not cost time either.
6. **There is a remedy when the technology fails, not only the network.** UX 11.2 point 6 covers a sustained outage by void and regrant. The policy must also cover assistive-technology failure during an attempt (a screen reader crash, a speech engine hang). The learner needs to know whom to tell while it is happening: A11Y-08.
7. **Integrity detection does not punish assistive technology.** The accommodation flag tells the assessor how to read the log, which is good. It does not stop the learner's experience: a screen reader or magnifier that takes focus will raise the modal overlay again and again, each time interrupting and costing seconds, in an exam that cannot be paused. For flagged learners, log silently and show no overlay for focus-loss events shorter than the grace period. The prototype does not show this case; it needs a decision.
8. **On-demand time for non-visual users.** Met by design: `role="timer"` with no live region, a name that changes each minute, threshold announcements at 15, 5 and 1 minute, and Alt+T. Fix A11Y-06 so that the visible label and the name agree.

**AAA notes, not required.** 2.2.3 No Timing is not met and cannot be while the limit is essential; record that in the accessibility statement and do not claim it. 2.2.6 Timeouts: tell users at sign-in how long inactivity lasts before sign-out, and that drafts are kept; the exam side is already covered by local and server persistence.

**Verdict**: keep the position. Make conditions 2, 3, 4 (upload expiry and session warning) and 7 true before the first live exam. Until then it is a claim on paper.

---

## 5. What is done well

Short, and only what is worth defending when the React build starts.

- **Native first.** `dialog.showModal()` (inert background for free), `details` and `summary` for menus with no fake `menu` roles, real radios and checkboxes inside choice cards with the native control still visible, real `fieldset` and `legend` on rubric rows, real `table`, `caption` and `th scope="col"`.
- **The exam timer.** `role="timer"`, never a live region, minute-granular name, three threshold announcements through one shared polite announcer, a low-time state made of text prefix plus icon plus border (no colour-only cue, no motion), and "Hide seconds". This is the hardest part to get right and it is right.
- **Focus management in the exam.** Skip links come first; focus goes to the question `h1` on every change; the integrity overlay makes the shell `inert`, traps Tab and returns focus to the exact control (verified); Escape does not dismiss it; the submit dialog focuses "Go back", gates "Submit exam" behind a checkbox, and returns focus to "Submit exam" on Escape (verified).
- **`scroll-padding` fed by `:has()` for sticky regions.** No fully hidden focused control on any learner page at 375 px or on any staff page at 1366 px, apart from the bulk bar. The idea is sound; A11Y-02 to A11Y-04 are the cases it does not cover yet.
- **Status never by colour alone.** Tags are tone plus shape plus words; navigator states have a glyph and an accessible name that includes the state; upload rows state their condition in words; "Unread" is visually hidden text plus weight plus a bar.
- **Blocked actions explain themselves in visible text** tied with `aria-describedby`, never a tooltip. There is no hover-only or focus-only content anywhere, so 1.4.13 is not applicable.
- **Refusal and advisory are told apart** (`admin-roles.html`: `role="status"` "For your information" against `role="alert"` "The role was not ended"), and refusals name the rule, the person, the evidence and the alternatives.
- **Error handling.** The error summary has `role="alert"`, takes focus and links to fields; fields get `aria-invalid` and the error id added to `aria-describedby` (`assess-marking`, `learn-appeal-new`, `sign-in`). Sign-in does not reveal which field was wrong.
- **Sign-in**: `autocomplete` tokens, show password, no CAPTCHA, a lockout with a time and two ways out.
- **Dates and deadlines**: written as the last full day, with the weekday, "including weekends and public holidays", and SAST stated once. The appeal closing date is on the result page, on the home card and in the notification, never behind a click.
- **Reduced motion** is one global rule plus spinner and progress fallbacks. Print is handled, and the exam prints a notice instead of the questions.
- **Zoom and paste are not blocked**; the viewport meta allows pinch zoom; the accommodation permits paste.

---

## 6. Fix list for the prototype owner

Shared files first; within each file the highest-leverage fix first.

**`assets/ui.css`**
- [x] A11Y-02: `@media (max-height: 30rem), (max-width: 47.99rem)`: `.exam-shell__actions` static; `.exam-bar` on one row (hide title and position, truncate the status line); set `--sticky-top` and `--sticky-bottom` to match.
- [x] A11Y-03: in the same `max-height` query, make `.section-switcher`, `.decision-bar`, `.action-bar` and `.bulk-bar` static and set `--sticky-bottom: 0px`.
- [x] A11Y-04: add `scroll-padding-bottom` for `html:has(.bulk-bar:not([hidden]))`, desktop and select-mode phone values.
- [ ] A11Y-10: style `tbody th` wherever `.table td` and `.table--cards td` are styled, so that row headers can be real `th` elements.
- [ ] A11Y-13: extend the `forced-colors` block (segmented control, filter chip, pagination, navigator answered state, progress and chart bars, tag shapes, unread dot, today marker).
- [ ] A11Y-19: `.btn { white-space: normal; text-align: center; }`; keep `nowrap` on `.btn--icon` only.
- [ ] A11Y-20: `.link--standalone { min-height: 2.75rem; }` below `md`.
- [ ] A11Y-06: update the `.timer` comment to the "Less than N minutes left" wording.

**`assets/ui.js`**
- [ ] A11Y-07: add a session-expiry `alertdialog` helper (open, extend, focus return).
- [ ] A11Y-15: a small `announce(text, assertive)` helper that injects text into regions that already exist, so that pages stop revealing `role="alert"` containers by toggling `hidden`.

**`components.html`** (the pattern source; fix here and then copy)
- [ ] A11Y-14: disabled pagination item becomes `span[role=link][aria-disabled]` or `button[disabled]`.
- [ ] A11Y-10: table pattern with `<th scope="row">`; card mode with explicit roles; `data-label` equal to the header text.
- [ ] A11Y-12: every `.table-wrap` that can overflow is a focusable labelled region.
- [ ] A11Y-11: upload pattern: requirement title tied to the input; alert region for "not accepted" and "expired".
- [ ] A11Y-07: session-expiry dialog specimen.
- [ ] A11Y-21: "Cannot be chosen" as a plain list; blocked reason placed before the disabled control.
- [ ] A11Y-18: delivery-evidence summary with visually hidden context.

**`learn-exam-preflight.html`**
- [ ] A11Y-01: replace `u-hide-below-lg` on the Start card and the Resume button with a device-based gate (hover and pointer); rewrite the narrow-window check row.
- [ ] A11Y-05: promote the extra-time and assistive-software note to an `h2` section with a contact, a link and a date to ask by.
- [ ] A11Y-21: blocked reason before the disabled "Start exam".

**`exam-attempt.html`**
- [ ] A11Y-02: navigator closed by default below `lg`.
- [ ] A11Y-06: threshold label wording; `aria-label` built from the same string.
- [ ] A11Y-08: add "Problem? Tell your invigilator or coordinator." to the navigator panel and to each notice panel.
- [ ] A11Y-09: "Come back to this later" in place of "Mark to come back to"; update the navigator names, the key, the review table and the dialog list.
- [ ] A11Y-16: integrity overlay heading and body; remove "(2 so far)".
- [ ] A11Y-15: offline message through `#xm-announce`, one sentence; the banner becomes a labelled region.
- [ ] A11Y-17: `main` around the takeover and gate panels; a label on the navigator; `footer#actions` becomes `div[role=group]`.
- [ ] A11Y-23: hide the skip links while an overlay is open; takeover focus on the `h1`; `e.key` fallback for shortcuts; remove the static `role="status"` on `.question__notice`.

**`learn-result.html`**
- [ ] A11Y-20: "Appeal this result" as a secondary button on its own line.
- [ ] A11Y-10: criterion cell as `th scope="row"`; `data-label="Assessor's comment"`.

**`learn-home.html`**
- [ ] A11Y-05: one line plus a link about extra time in the Exam card.
- [ ] A11Y-10: row headers; `data-label="Deadline (SAST)"`.
- [ ] A11Y-20: header links as 44 px standalone links.
- [ ] A11Y-24: split the "We have your work" banner text (also in `learn-task`, `learn-result`, `exam-receipt`).

**`learn-task.html`**
- [ ] A11Y-11: `aria-describedby` from each file input to its requirement title; an alert region for rejected and expired rows; state how long a paused upload waits.
- [ ] A11Y-24: "late flag" wording.
- [ ] A11Y-10: row headers; `data-label="What your assessor looks for"`.

**`learn-appeal-new.html`**
- [ ] A11Y-09: "re-mark" or "marked again" throughout; "See my work with the marks".
- [ ] A11Y-20: "See the result and feedback" target height.

**`notifications.html`, `coordinate-appeals.html`, `teach-submissions.html`**
- [ ] A11Y-14: pagination arrows.
- [ ] A11Y-18: summary context (`notifications.html`).

**`assess-marking.html`, `moderate-item.html`**
- [ ] A11Y-12: `.workspace__panel` as a focusable labelled region; read-only rubric as text, not disabled inputs.

**`admin-configuration-key.html`**
- [ ] A11Y-12: `.table-wrap` focusable and labelled.

**`admin-roles.html`, `coordinate-appeal-detail.html`, `coordinate-moderation.html`, `coordinate-cohort-setup.html`**
- [ ] A11Y-15: remove `role="alert"` from containers whose heading receives focus.
- [ ] A11Y-21: excluded reviewers as a list (`coordinate-appeal-detail.html`).

**`moderate-signoff.html`, `sign-in.html`**
- [ ] A11Y-21: move `.blocked-reason` above the disabled controls.
- [ ] A11Y-22: pre-fill `#email-f` (`sign-in.html`).

**Design documents**
- [ ] UX architecture 8.3: threshold label wording (A11Y-06). 8.4 and 8.6: "server" wording (A11Y-24). 8.5: overlay text, the tally, behaviour for flagged learners (A11Y-16; section 4, condition 7). 11.3: add upload rejection and expiry (A11Y-11). 12 Q5: mark as a release blocker for exams (section 4, condition 2).

---

## 7. Carry into the real build

A static prototype cannot prove any of the following. Each should become an acceptance criterion or a test task.

**Screen reader matrix, per P0 flow, before release**

| AT and browser | Platform | Must cover |
|---|---|---|
| NVDA with Chrome and with Firefox | Windows 11 | Exam end to end: timer silence, three threshold announcements once each, Alt+T, offline and recovery announcements, integrity overlay and return, takeover, time up, submit dialog, receipt. Marking: rubric radios with legend, error summary, finalise dialog. |
| JAWS with Chrome or Edge | Windows 11 | Same exam flow; forms-mode behaviour in the reviewer list (A11Y-21); card-mode tables. |
| VoiceOver with Safari, and with Chrome (the exam names Chrome, Edge and Firefox as supported, so Mac screen reader users will be on Chrome) | macOS | Exam flow; `details` menus; `dialog`. |
| VoiceOver with Safari | iOS | Learner home, task upload in all seven row states, result, appeal, notifications. Card-mode tables (A11Y-10). Generated `data-label` text. |
| TalkBack with Chrome | Android, a low-end device | Same learner flows on a throttled connection. |

Record what was actually spoken for each status message in UX 11.3. "Announced once" is the requirement that most often fails in practice: it is either doubled or silent.

**Zoom and text size**
- Real browser zoom at 200% and 400% on a 1366 x 768 laptop for the exam (pre-flight, attempt, overlays, review table, dialog) and for the marking workspace. Re-run the focus-obscured script from section 2.2 in CI at 320 x 256, 640 x 512 and 1366 x 768.
- Android system font size at its largest, and iOS Dynamic Type through Safari. For information only: a text-only 200% test at 375 px made the top bar 112 px and the bottom tabs 120 px with one tab label clipped. That is beyond what 1.4.4 requires on a phone where pinch zoom works, but learners will meet it.
- Set `--sticky-top` and `--sticky-bottom` at run time from a `ResizeObserver` instead of from tokens.

**High contrast and themes**
- Windows contrast themes (one dark, one light) against both app themes, after A11Y-13. macOS Increase Contrast. axe in CI on every P0 route in both themes, which UX 11.4 already requires.

**Exam-specific**
- Fullscreen entry and exit with each screen reader: where focus lands, and whether the overlay is announced.
- Focus-loss detection against NVDA, JAWS, Windows Magnifier, ZoomText, the Windows on-screen keyboard, Dragon and Windows Voice Access. Count the false events in a 30-minute sitting for each, and use the numbers to settle section 4, condition 7.
- Paste blocking against speech-to-text and switch software under the accommodation.
- A practice exam in the same shell (UX 8.8) available to every learner before their first summative exam, and used as the vehicle for usability testing with assistive technology.
- A policy for learners whose only accessible device is a tablet. The mobile gate refuses tablets with keyboards outright, and some learners use switch access or an iPad as their primary assistive setup. That needs an accommodation path such as an invigilated sitting at the centre, not a dead end.

**Accessible authentication (3.3.8)**
- ADR-026 mentions a challenge after failed sign-ins. If one is ever added it must have a non-cognitive route (an email link or a passkey), must not be an image or puzzle CAPTCHA, and must not block password managers or paste. Multi-factor authentication for staff: support passkeys or push approval, not only typed one-time codes. Password reset must not contain a transcription step.

**Status messages that need a real implementation to judge**
- Upload progress at 25% steps, pause, resume, completion, rejection, expiry. Draft saved. Filter result counts ("23 learners shown"). Bulk selection counts. Route changes in the app router: focus to the `h1` and a title update. Toast timing with a screen reader.

**Content accessibility (outside the UI, inside the product)**
- Uploaded learning material: PDF, Word, PowerPoint and scanned images. Require or prompt for tagged PDFs, flag scanned image PDFs at upload, and give facilitators a short checklist. Assessor feedback files returned to learners need the same.
- The evidence viewer: if it renders PDFs to canvas, screen reader users get nothing. Provide the original file and a text layer.
- Lecture recordings (1.2.2, 1.2.4, 1.2.5): the caption prompt at upload that UX 11.1 lists as an assumption; a player with keyboard control and visible captions.
- Learner-facing PDFs that the system generates (receipts, statements of results) must be tagged.
- Email notifications: plain, semantic HTML with a text alternative; the appeal closing date in the body, not only behind the link.

**People**
- Usability testing with disabled learners, not only the "lower technical confidence" group in UX 11.4: at least one screen reader user, one magnification user, one person with a motor impairment using a phone, and one learner for whom English is a third language. Flow A on their own phone; Flow B (the exam) on a centre laptop with their own assistive technology.
- A second-language plain-language review of all learner and exam copy by a South African reader, covering section 3 items A11Y-09, A11Y-16 and A11Y-24.
- An accessibility statement that names the 2.2.1 essential exception, how to request accommodations, the supported assistive technology and browsers, and a contact.

**Re-audit**: after A11Y-01 to A11Y-04 are fixed in the prototype, and again on the first React build of the exam shell. The second one must include the screen reader matrix above.
