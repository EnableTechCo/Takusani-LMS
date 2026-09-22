import { notFound } from "next/navigation";
import { Button, IconButton } from "@/components/ui/button";
import { BlockedReason, ButtonLink, TextLink } from "@/components/ui/link";
import { Checkbox, Choice, ChoiceGroup, Fieldset, Radio } from "@/components/ui/choice";
import { ConflictPanel } from "@/components/ui/conflict";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { Menu, MenuButton, MenuDivider, MenuLink } from "@/components/ui/menu";
import { Stepper, Subnav } from "@/components/ui/process";
import { DateTime, HistoryList, Log, Receipt } from "@/components/ui/records";
import { Banner, EmptyState, Meter, StatusLine, Tag } from "@/components/ui/status";
import { DataTable, Pagination } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { GalleryDialogs, GalleryErrorSummary, GalleryRefusal, GalleryToast } from "./gallery-client";

export const metadata = { title: "Components" };

/**
 * The component library in every state, with the prototype's example content (docs/design/ui/prototype/
 * components.html). For building and reviewing screens locally; not served in production.
 */

const QUEUE = [
  {
    id: "1",
    name: "Lerato Mokoena",
    number: "KSI-2026-0417",
    item: "Task 3",
    at: "2026-09-04T17:42:00+02:00",
    late: true,
    version: 2,
  },
  {
    id: "2",
    name: "Sipho Zulu",
    number: "KSI-2026-0398",
    item: "Unit 2 summative exam",
    at: "2026-09-02T11:00:00+02:00",
    late: false,
    version: 1,
  },
  {
    id: "3",
    name: "Ayesha Patel",
    number: "KSI-2026-0422",
    item: "Task 3",
    at: "2026-09-04T09:15:00+02:00",
    late: false,
    version: 1,
  },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="stack">
      <h2 className="text-title" id={`${id}-h`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="page">
      <header className="page-header">
        <p className="page-header__workspace">Design system</p>
        <h1 className="page-header__title">Components</h1>
        <p className="page-header__lead">
          The React component library in src/components/ui, in each state. Specimens use the prototype&apos;s example
          content.
        </p>
      </header>
      <div className="stack stack--lg">
        <Section id="actions" title="Buttons and links">
          <div className="cluster">
            <Button variant="primary">Submit for assessment</Button>
            <Button>Save draft</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Void attempt</Button>
            <Button variant="destructive-quiet">Remove file</Button>
          </div>
          <div className="cluster">
            <Button disabled variant="primary">
              Submit for assessment
            </Button>
            <Button loading loadingLabel="Checking whether your work went through" variant="primary">
              Submitting
            </Button>
            <Button loading loadingLabel="Saving, please wait">
              Saving
            </Button>
          </div>
          <div className="cluster">
            <Button icon="upload" size="lg" variant="primary">
              Upload evidence
            </Button>
            <Button icon="download" size="sm">
              Export CSV
            </Button>
            <IconButton icon="dots" label="More actions" />
            <IconButton icon="printer" label="Print receipt" size="sm" variant="secondary" />
            <ButtonLink href="/components">A link styled as a button</ButtonLink>
          </div>
          <div className="cluster">
            <Button aria-describedby="blocked-1" disabled variant="primary">
              Sign off and release
            </Button>
            <BlockedReason id="blocked-1">
              You cannot sign off yet: 1 returned item is still open. It is listed below.
            </BlockedReason>
          </div>
          <p>
            Inline link: read the <TextLink href="/components">late submission policy</TextLink> before you submit.
            Quiet link:{" "}
            <TextLink href="/components" quiet>
              view version 1
            </TextLink>
            .
          </p>
          <p>
            <TextLink external="opens Microsoft Teams" href="https://teams.microsoft.com" standalone>
              Join the session in Microsoft Teams
            </TextLink>
          </p>
        </Section>

        <Section id="forms" title="Forms">
          <div className="grid grid--2">
            <form className="stack" noValidate>
              <GalleryErrorSummary />
              <TextField defaultValue="Task 3: Workplace records portfolio" label="Task title" name="title" />
              <TextareaField
                error="Enter your reasons. We cannot review an appeal without them."
                help="Refer to the criteria and to the pages of your submission. A remark can move your mark up or down."
                label="Why does the mark not reflect the work you submitted?"
                markRequired
                maxLength={2000}
                name="grounds"
              />
              <TextField
                defaultValue="2026-09-14"
                error="14 Sep 2026 has passed. Choose a later day."
                help="The learner has the whole of this day."
                label="Corrections due by the end of"
                name="deadline"
                type="date"
              />
              <SelectField
                defaultValue="u3"
                label="Unit"
                name="unit"
                options={[
                  { value: "u3", label: "Unit 3: Workplace records" },
                  { value: "u4", label: "Unit 4: Business communication" },
                ]}
                valid="8 credits at NQF level 4"
              />
              <TextField
                label="Search learners"
                name="search"
                optional
                placeholder="Name or learner number"
                type="search"
              />
              <TextField
                defaultValue="rule-v4 · seed 8841207"
                label="Sampling rule and seed"
                mono
                name="rule"
                readOnly
              />
            </form>
            <div className="stack">
              <Fieldset legend="Send this notice to">
                <Checkbox
                  defaultChecked
                  help="96 people"
                  label="Learners in 2026 Intake B"
                  name="to"
                  value="learners"
                />
                <Checkbox label="Facilitators and assessors" name="to" value="staff" />
                <Checkbox
                  disabled
                  help="Not a notice recipient. The Department reads records through the API."
                  label="Department of Education"
                  name="to"
                  value="doe"
                />
              </Fieldset>
              <Fieldset legend="When should it go out?">
                <Radio defaultChecked label="Now" name="when" value="now" />
                <Radio label="At a scheduled time" name="when" value="later" />
              </Fieldset>
              <ChoiceGroup columns={2} legend="What are you asking for?">
                <Choice
                  defaultChecked
                  description="See your submission with the marks for each criterion and your assessor's feedback."
                  name="appeal"
                  title="View my marked script"
                  value="view"
                />
                <Choice
                  description="A different reviewer marks your work again. The mark can go up or down. That decision is final."
                  name="appeal"
                  title="Request a remark"
                  value="remark"
                />
              </ChoiceGroup>
              <ChoiceGroup columns={2} legend="Outcome">
                <Choice name="outcome" title="Competent" tone="positive" value="c" />
                <Choice defaultChecked name="outcome" title="Not yet competent" tone="caution" value="nyc" />
              </ChoiceGroup>
            </div>
          </div>
        </Section>

        <Section id="status" title="Tags, banners, status lines and meter">
          <div className="cluster">
            <Tag>Neutral</Tag>
            <Tag tone="info">Info</Tag>
            <Tag shape="half" tone="info">
              Info, in progress
            </Tag>
            <Tag tone="positive">Positive</Tag>
            <Tag tone="caution">Caution</Tag>
            <Tag tone="critical">Critical</Tag>
            <Tag shape="square">Neutral, final</Tag>
            <Tag plain>Plain</Tag>
          </div>
          <div className="cluster">
            <Tag large tone="positive">
              Competent
            </Tag>
            <Tag large tone="caution">
              Not yet competent
            </Tag>
          </div>
          <Banner title="We have your work" tone="info">
            <p>You will get a message here and by email when your result is ready.</p>
          </Banner>
          <Banner title="Term 3 tasks signed off" tone="positive">
            <p>96 results were released and 96 learners notified on 22 Sep 2026 at 14:05.</p>
          </Banner>
          <Banner
            actions={<TextLink href="/components">View the open item</TextLink>}
            role="alert"
            title="You cannot sign off yet: 1 returned item is still open"
            tone="caution"
          >
            <p>Lerato Mokoena, Task 3, is with Thandiwe Nkosi for a re-mark, due Thursday 17 September 2026.</p>
          </Banner>
          <Banner title="The LMS is having trouble right now" tone="critical">
            <p>Your work is safe. Trying again...</p>
          </Banner>
          <Banner title="2025 Intake A is archived" tone="readonly">
            <p>This cohort is read-only. Records and reports can still be read and exported.</p>
          </Banner>
          <div className="cluster">
            <StatusLine state="saving">Saving</StatusLine>
            <StatusLine state="local">Saved on this device</StatusLine>
            <StatusLine state="saved" time="10:42">
              Saved
            </StatusLine>
            <StatusLine state="locked">Submitted and locked</StatusLine>
            <StatusLine state="problem">
              Not saved to the server. Your answers are being kept on this device.
            </StatusLine>
          </div>
          <div className="grid grid--2">
            <Meter label="Held result age" max={30} value={12} valueText="12 of 30 days" />
            <Meter caution label="Held result age" max={30} value={27} valueText="27 of 30 days" />
          </div>
        </Section>

        <Section id="tables" title="Table, with cards on phones">
          <DataTable
            caption="Marking queue for 2026 Intake B, sorted by submitted time, oldest first"
            columns={[
              {
                key: "learner",
                header: "Learner",
                primary: true,
                sort: { direction: "none", href: "/components?sort=learner" },
                cell: (row) => (
                  <>
                    <span className="table__primary">{row.name}</span>
                    <span className="table__secondary mono">{row.number}</span>
                  </>
                ),
              },
              { key: "item", header: "Item", cell: (row) => row.item },
              {
                key: "submitted",
                header: "Submitted (SAST)",
                sort: { direction: "ascending", href: "/components?sort=-submitted" },
                cell: (row) => <DateTime iso={row.at} />,
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => (row.late ? <Tag tone="caution">To mark, Late</Tag> : <Tag>To mark</Tag>),
              },
              { key: "version", header: "Version", numeric: true, cell: (row) => row.version },
              {
                key: "actions",
                header: "Actions",
                actions: true,
                cell: (row) => (
                  <ButtonLink href="/components" size="sm">
                    Mark<span className="u-visually-hidden"> {row.name}</span>
                  </ButtonLink>
                ),
              },
            ]}
            rowKey={(row) => row.id}
            rows={QUEUE}
          />
          <Pagination
            href={(page) => `/components?page=${page}`}
            label="Queue pages"
            page={3}
            pageCount={8}
            summary="Showing 51 to 75 of 190"
          />
          <div className="card">
            <EmptyState title="Nothing to mark right now">
              <p>New submissions from 2026 Intake B will appear here.</p>
            </EmptyState>
          </div>
        </Section>

        <Section id="process" title="Tabs, sub-navigation and steps">
          <Tabs
            label="Marking panel"
            tabs={[
              { id: "rubric", label: "Rubric", content: <p>The rubric rows for Unit 3 appear here.</p> },
              { id: "feedback", label: "Feedback", content: <p>Overall feedback, written for the learner.</p> },
              { id: "integrity", label: "Integrity", count: 2, content: <p>Integrity is shown for exams only.</p> },
              { id: "history", label: "History", count: 2, content: <p>Version 2 is current.</p> },
            ]}
          />
          <Subnav
            items={[
              { label: "Overview", href: "/components", current: true },
              { label: "Setup", href: "/components?setup" },
              { label: "People", href: "/components?people" },
            ]}
            label="2026 Intake B"
          />
          <Stepper
            label="Progress of your appeal APL-2026-0031"
            steps={[
              {
                label: "Received",
                state: "complete",
                meta: "24 Sep 2026, 08:14",
                body: "You asked for a remark of Task 3.",
              },
              { label: "Accepted", state: "complete", meta: "25 Sep 2026, 10:02" },
              { label: "Being reviewed", state: "current", meta: "With a reviewer since 25 Sep 2026" },
              { label: "Decided", state: "upcoming", body: "The decision is final." },
            ]}
          />
          <Stepper
            horizontal
            label="Term 3 tasks: moderation cycle progress"
            steps={[
              { label: "Planned", state: "complete", meta: "7 Sep" },
              { label: "Sampled", state: "complete", meta: "14 Sep · 22 of 96" },
              { label: "In review", state: "complete", meta: "21 agreed, 1 returned" },
              { label: "Waiting for re-marks", state: "blocked", body: "1 returned item is open." },
              { label: "Signed off", state: "upcoming", body: "Releases all 96 results." },
            ]}
          />
        </Section>

        <Section id="menus" title="Menus, dialogs and toasts">
          <div className="cluster">
            <Menu label="More actions">
              <MenuLink href="/components" icon="download">
                Export CSV
              </MenuLink>
              <MenuButton icon="refresh">Reallocate</MenuButton>
              <MenuDivider />
              <MenuLink href="/components" icon="archive" meta="Read-only afterwards">
                Archive cohort
              </MenuLink>
            </Menu>
            <GalleryDialogs />
            <GalleryToast />
          </div>
        </Section>

        <Section id="records" title="Receipts, history, logs and conflicts">
          <div className="grid grid--2">
            <Receipt
              note="What happens next: your work will be assessed. Keep this reference in case you need to ask about this submission."
              reference="SUB-2026-0904-7K2M"
              rows={[
                { label: "Learner", value: "Lerato Mokoena · KSI-2026-0417" },
                { label: "Task", value: "Task 3: Workplace records portfolio" },
                { label: "Received", value: "Friday 4 September 2026 at 17:42 (SAST)" },
              ]}
              title="We have your work"
            />
            <div className="stack">
              <HistoryList
                entries={[
                  { id: "v2", badge: "v2", title: "Version 2", meta: "4 Sep 2026, 17:42 · 3 files", current: true },
                  {
                    id: "v1",
                    badge: "v1",
                    title: "Version 1",
                    meta: "28 Aug 2026, 16:55 · replaced by version 2, kept on record",
                    actions: (
                      <ButtonLink href="/components" size="sm" variant="ghost">
                        View<span className="u-visually-hidden"> version 1</span>
                      </ButtonLink>
                    ),
                  },
                ]}
                label="Submission versions, newest first"
              />
              <GalleryRefusal />
              <ConflictPanel advisory title="Assigned, with a separation-of-duties note">
                Anil Naidoo is now a moderator for 2026 Intake B. He also assesses in this cohort, so he will not be
                offered items he assessed.
              </ConflictPanel>
            </div>
          </div>
          <Log
            boxed
            entries={[
              {
                id: "1",
                at: "2026-09-02T09:00:02+02:00",
                actor: "Sipho Zulu",
                event: "started the attempt.",
                detail: "attempt 7c41e0",
              },
              {
                id: "2",
                at: "2026-09-02T09:21:47+02:00",
                actor: "System",
                event: "recorded a window switch.",
                marked: true,
              },
              {
                id: "3",
                at: "2026-09-02T11:00:00+02:00",
                actor: "System",
                event: "submitted the attempt when time ran out.",
              },
            ]}
            label="Exam record for Sipho Zulu, oldest first. Times in SAST."
          />
        </Section>
      </div>
    </div>
  );
}
