# LMS Capacity Estimates

## Purpose and estimation method

These estimates test whether the proposed architecture is proportionate. Confirmed requirements are separated from assumptions and calculations. Ranges deliberately avoid false precision. Storage uses decimal units.

## Inputs

| Input | Value | Classification |
|---|---:|---|
| Registered learners | 1,000 | Confirmed architecture target |
| Daily active learners | 300-600 | Assumption, 30%-60% of registered learners |
| Baseline concurrent exams | 100 | Confirmed baseline |
| Temporary exam sensitivity case | 250 | Planning assumption |
| Server autosave interval | 10 seconds, jittered | Recommended default |
| Normal interactions per DAU per day | 50-150 | Assumption including page/API activity |
| Peak factor for normal traffic | 5x average | Conservative assumption for timetable-driven use |
| Coursework submissions per learner per year | 12-40 | Range pending programme definition |
| Average submission versions | 1.2-1.5 | Assumption |
| Typical uploaded bytes per submission version | 5-25 MB | Assumption; limits remain configurable |
| Evidence files per learner per year | 5-20 | Assumption |
| Typical evidence size | 5-25 MB | Assumption |
| Decision/audit retention | 5 and 7 years modelled | Scenario, not policy |

## Scenario 1 Normal operation

Average request rate:

`DAU x interactions per day / 86,400 seconds`

- Low: `300 x 50 / 86,400 = 0.17 requests/second`
- High: `600 x 150 / 86,400 = 1.04 requests/second`
- Five-times timetable peak: approximately `0.9-5.2 requests/second`

Even a further ten-times safety factor remains well below the order of magnitude that requires database distribution. Query shape, indexes, connection pooling, and slow reports matter more than raw request volume.

## Scenario 2 Baseline exam peak

Autosave rate:

`concurrent attempts / autosave interval = 100 / 10 = 10 writes/second`

This is a request rate. Autosave is one batch per attempt per interval however many answers changed (ADR-023), so the request rate does not grow with edits; each request upserts one row per changed answer, typically one to three, in a single database round trip with no separate rate-bucket write.

A 20% synchronization allowance gives `12 writes/second`. Client jitter should spread saves across the interval. Starting 100 exams over one minute creates `100 / 60 = 1.7 starts/second`; final submission has the same planned burst. A stricter five-second autosave would double this to 20 writes/second without changing the architecture.

## Scenario 3 Temporary higher-concurrency exam

`250 / 10 = 25 autosave writes/second`

With the same 20% allowance, size for approximately 30 autosave writes/second. Starts or submissions spread over one minute produce `250 / 60 = 4.2 commands/second`. The design must load-test synchronized starts, autosave synchronization, reconnect replay, and final submission locking rather than assume the averages.

## Scenario 4 Bulk result release

For a worst-case 1,000-recipient release:

- One transaction updates the releasable result rows, appeal deadlines, credit-ledger entries, in-app notifications, audit events, and outbox rows.
- Email is not sent inside that transaction.
- A 15-minute notification-drain objective requires `1,000 / 900 = 1.1 jobs/second` sustained.
- A worker rate of 5 jobs/second drains the burst in roughly 200 seconds before provider throttling and retries.

The queue therefore improves dependency isolation and recovery, not raw throughput.

## Scenario 5 Bulk learner import

A 1,000-row intake processed in batches of 100 creates ten transactional batches. At one batch per second, database ingestion finishes in about ten seconds excluding validation and Auth invitation limits. Invitations are queued and paced separately because email and authentication providers impose their own quotas.

## Database row growth

| Record family | Formula | Annual range |
|---|---|---:|
| Submission versions | `1,000 x 12-40 x 1.2-1.5` | 14,400-60,000 |
| Assessment decisions | submission versions plus revisions | 15,000-70,000 |
| Exam answers | `attempts x questions`; assume 4-12 exams and 30-100 questions | 120,000-1,200,000 |
| Exam integrity events | `attempts x 0-20 events` | 0-240,000 |
| Credit-ledger entries | `learners x 12-40 units x adjustments factor 1.0-1.1` | 12,000-44,000 |
| Audit events | One per workflow transition: submissions, decisions, two per exam attempt, releases, credits, plus administrative events | 60,000-250,000 |
| Notification records | 20-100 per learner | 20,000-100,000 |
| Material access events | `1,000 x 200-1,000 coalesced opens` | 200,000-1,000,000 |
| Quiz attempts and responses | `1,000 x 20-60 attempts x 10-20 questions` | 200,000-1,200,000 |
| Calendar feed requests | `1,000 tokens x 24-96 polls/day`; reads only, mostly `304`; `last_used_at` written at most hourly per token | 0.3-1.1 requests/second; under 0.3 writes/second |

At the high end, seven years of exam-answer rows remain under ten million. This calls for proper compound indexes, pagination, archival policy, and query monitoring, not sharding. Time-based table partitioning is a future option only if append-heavy audit or integrity tables become difficult to retain and maintain.

## Object-storage growth

Coursework storage per year:

`learners x submissions x versions x average bytes`

- Low: `1,000 x 12 x 1.2 x 5 MB = 72 GB/year`
- High: `1,000 x 40 x 1.5 x 25 MB = 1.5 TB/year`

Evidence storage per year:

- Low: `1,000 x 5 x 5 MB = 25 GB/year`
- High: `1,000 x 20 x 25 MB = 500 GB/year`

Combined source-object range is approximately 97 GB-2 TB/year before provider durability overhead. Five-year range: 0.5-10 TB. Seven-year range: 0.7-14 TB. Actual retention, compression, file limits, and lecture-recording policy dominate this estimate and require confirmation. The high case carries a recurring Storage charge and doubles under replication to a second bucket, with matching transfer; neither is priced here, and both belong in the ADR-027 cost decision.

Lecture recordings are excluded from the range above. FR-208 permits upload as well as link, and an uploaded recording is far larger than any submission. As an assumption, `200-500 sessions/year x 0.3-1 GB = 60-500 GB/year` if every recording were uploaded, which would rival the whole coursework estimate. The recommended default is a link to the Teams recording, with upload limited by the configured file limit and served as a Storage download rather than adaptive streaming, consistent with NFR-01.

Direct browser-to-Storage upload keeps this bandwidth away from Vercel. At 100 simultaneous 25 MB uploads over five minutes, aggregate ingress is about `2.5 GB / 300 = 8.3 MB/second`; Storage, client connectivity, and retry behaviour are the constraints.

## Department API and reporting

Assume 1,000-10,000 record reads per day: `0.01-0.12 requests/second` average. A scheduled consumer may burst, so the API uses cursor pagination, bounded page sizes, credential-specific throttling, and indexed filters. Large exports become asynchronous report jobs rather than unbounded HTTP responses.

## Scaling triggers

| Signal | Current response | Revisit trigger |
|---|---|---|
| Exam autosave p95 latency | Tune indexes, pool size, payload, and jitter | p95 exceeds 500 ms at 250 attempts |
| Database CPU or I/O | Query tuning and compute upgrade | Sustained above 70% during normal peaks |
| Connection pool | Most traffic uses the Data API, so watch its pool as well as the SQL pooler used by sign-off and the worker | Wait time above 100 ms or saturation above 80% |
| Autosave latency budget | One database round trip per save; functions pinned to the database region | Round trip from South African clients leaves under 200 ms for the function |
| Sign-off duration | Set-based release over the SQL path with an explicit timeout | 1,000 results exceed two seconds in CI |
| Queue lag | Increase bounded worker concurrency | Oldest message above 5 minutes for 15 minutes |
| Audit/integrity tables | Retention and archival | Maintenance or queries breach SLO after indexing |
| Object storage | Lifecycle and retention review | Growth exceeds the high projection or recovery cannot meet policy |
| Department API | Increase page/credential controls | Sustained traffic exceeds 20 requests/second or contractual SLA changes |

## Conclusion

The workload is comfortably served by one managed PostgreSQL primary with correct indexes and pooled connections. Exam reliability is a concurrency-correctness problem, not a distributed-scale problem. The first likely constraints are poorly indexed workflow queries, connection bursts from serverless functions, large exports, provider quotas, and ungoverned file retention.

