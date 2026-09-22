import Link from "next/link";

export const metadata = { title: "Notifications" };

// Ported from docs/design/ui/prototype/notifications.html (default state). Static shell: no data or behaviour yet.
export default function NotificationsPage() {
  return (
    <>
      <div className="page page--prose">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/learn">Home</Link>
              </li>
              <li aria-current="page">Notifications</li>
            </ol>
          </nav>
          <h1 className="page-header__title">Notifications</h1>
          <p className="page-header__lead">
            2 unread. Every message here is also a record of when and how we told you.
          </p>
          <div className="page-header__actions">
            <button type="button" className="btn btn--secondary" data-toast="All notifications marked as read">
              Mark all as read
            </button>
          </div>
        </header>
        {/* Filters: toggle buttons above the list, as in the table toolbar. */}
        <div className="table-toolbar" role="group" aria-label="Filter notifications">
          <button type="button" className="filter-chip" aria-pressed="true">
            All
          </button>{" "}
          <button type="button" className="filter-chip" aria-pressed="false">
            Results
          </button>{" "}
          <button type="button" className="filter-chip" aria-pressed="false">
            Deadlines
          </button>{" "}
          <button type="button" className="filter-chip" aria-pressed="false">
            Appeals
          </button>{" "}
          <button type="button" className="filter-chip" aria-pressed="false">
            Notices
          </button>
        </div>
        <div className="stack stack--lg">
          {/* ===================== Default: Wednesday 23 September, morning ===================== */}
          <section aria-labelledby="day-today">
            <h2 className="text-subheading u-mb-4" id="day-today">
              Today, Wednesday 23 September 2026
            </h2>
            <ul className="notification-list" aria-label="Notifications from today">
              <li className="notification is-unread">
                <span className="notification__icon">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-video" />
                  </svg>
                </span>
                <span className="notification__title">
                  <span className="u-visually-hidden">Unread: </span>
                  <Link href="/learn">The Teams link for Session 15 on Tuesday 29 September is ready</Link>
                </span>
                <time className="notification__time" dateTime="2026-09-23T08:10:00+02:00">
                  23 Sep, 08:10
                </time>
                <span className="notification__body">
                  Session 15: Office administration, 09:00 to 11:00, with Pieter van Wyk.
                </span>
                <span className="notification__unread" aria-hidden="true" />
                <details className="delivery-evidence notification__extra">
                  <summary>How you were told</summary>
                  <ul className="delivery-evidence__list">
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">In the LMS</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-23T08:10:00+02:00">
                        23 Sep 2026, 08:10
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">Email: sending</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-23T08:10:00+02:00">
                        23 Sep 2026, 08:10
                      </time>
                    </li>
                  </ul>
                </details>
              </li>
              <li className="notification is-unread">
                <span className="notification__icon">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-clock" />
                  </svg>
                </span>
                <span className="notification__title">
                  <span className="u-visually-hidden">Unread: </span>
                  <Link href="/learn/tasks/task-3">
                    Reminder: you can resubmit Task 3 until the end of Tuesday 6 October 2026
                  </Link>
                </span>
                <time className="notification__time" dateTime="2026-09-23T07:00:00+02:00">
                  23 Sep, 07:00
                </time>
                <span className="notification__body">
                  13 days left. Your assessor asked for the access register and one more paragraph.
                </span>
                <span className="notification__unread" aria-hidden="true" />
                <details className="delivery-evidence notification__extra">
                  <summary>How you were told</summary>
                  <ul className="delivery-evidence__list">
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">In the LMS</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-23T07:00:00+02:00">
                        23 Sep 2026, 07:00
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">Email to l.mokoena@example.org: delivered</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-23T07:01:00+02:00">
                        23 Sep 2026, 07:01
                      </time>
                    </li>
                  </ul>
                </details>
              </li>
            </ul>
          </section>
          <section aria-labelledby="day-22">
            <h2 className="text-subheading u-mb-4" id="day-22">
              Tuesday 22 September 2026
            </h2>
            <ul className="notification-list" aria-label="Notifications from Tuesday 22 September">
              <li className="notification">
                <span className="notification__icon">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-check-circle" />
                  </svg>
                </span>
                <span className="notification__title">
                  <Link href="/learn/results/task-3">Your result for Task 3 is ready</Link>
                </span>
                <time className="notification__time" dateTime="2026-09-22T14:05:00+02:00">
                  22 Sep, 14:05
                </time>
                <span className="notification__body">You can appeal until the end of Tuesday 29 September 2026.</span>
                <details className="delivery-evidence notification__extra" open>
                  <summary>How you were told</summary>
                  <ul className="delivery-evidence__list">
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">In the LMS</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-22T14:05:00+02:00">
                        22 Sep 2026, 14:05
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">Email to l.mokoena@example.org: delivered</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-22T14:06:00+02:00">
                        22 Sep 2026, 14:06
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">First opened by you</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-22T18:31:00+02:00">
                        22 Sep 2026, 18:31
                      </time>
                    </li>
                  </ul>
                </details>
              </li>
            </ul>
          </section>
          {/* ===================== Result just released: Tuesday 22 September, 14:07 ===================== */}
          {/* ===================== Email could not be delivered: the LMS record still stands ===================== */}
          {/* ===================== Earlier (shared by the three non-empty states) ===================== */}
          <section aria-labelledby="day-earlier">
            <h2 className="text-subheading u-mb-4" id="day-earlier">
              Earlier this month
            </h2>
            <ul className="notification-list" aria-label="Earlier notifications">
              <li className="notification">
                <span className="notification__icon">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-megaphone" />
                  </svg>
                </span>
                <span className="notification__title">
                  <Link href="/">Notice from Zanele Dlamini: venue change for the contact session on 1 October</Link>
                </span>
                <time className="notification__time" dateTime="2026-09-14T15:20:00+02:00">
                  14 Sep, 15:20
                </time>
                <span className="notification__body">We have moved to Training Room 2. Lunch is provided.</span>
                <details className="delivery-evidence notification__extra">
                  <summary>How you were told</summary>
                  <ul className="delivery-evidence__list">
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">In the LMS</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-14T15:20:00+02:00">
                        14 Sep 2026, 15:20
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">Email to l.mokoena@example.org: delivered</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-14T15:21:00+02:00">
                        14 Sep 2026, 15:21
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">First opened by you</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-14T19:02:00+02:00">
                        14 Sep 2026, 19:02
                      </time>
                    </li>
                  </ul>
                </details>
              </li>
              <li className="notification">
                <span className="notification__icon">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-upload" />
                  </svg>
                </span>
                <span className="notification__title">
                  <Link href="/learn/tasks/task-3">We have your work: Task 3, version 2</Link>
                </span>
                <time className="notification__time" dateTime="2026-09-04T17:42:00+02:00">
                  4 Sep, 17:42
                </time>
                <span className="notification__body">Received late, at 17:42. Receipt SUB-2026-0904-7K2M.</span>
                <details className="delivery-evidence notification__extra">
                  <summary>How you were told</summary>
                  <ul className="delivery-evidence__list">
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">In the LMS</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-04T17:42:00+02:00">
                        4 Sep 2026, 17:42
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">Email to l.mokoena@example.org: delivered</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-04T17:43:00+02:00">
                        4 Sep 2026, 17:43
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">First opened by you</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-04T17:44:00+02:00">
                        4 Sep 2026, 17:44
                      </time>
                    </li>
                  </ul>
                </details>
              </li>
              <li className="notification">
                <span className="notification__icon">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-laptop" />
                  </svg>
                </span>
                <span className="notification__title">
                  <Link href="/learn">We have your exam: Unit 2 summative exam</Link>
                </span>
                <time className="notification__time" dateTime="2026-09-02T10:58:00+02:00">
                  2 Sep, 10:58
                </time>
                <span className="notification__body">Submitted at 10:58. It is now being assessed.</span>
                <details className="delivery-evidence notification__extra">
                  <summary>How you were told</summary>
                  <ul className="delivery-evidence__list">
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">In the LMS</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-02T10:58:00+02:00">
                        2 Sep 2026, 10:58
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">Email to l.mokoena@example.org: delivered</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-02T10:59:00+02:00">
                        2 Sep 2026, 10:59
                      </time>
                    </li>
                    <li className="delivery-evidence__row">
                      <span className="delivery-evidence__channel">First opened by you</span>
                      <time className="delivery-evidence__time" dateTime="2026-09-02T11:03:00+02:00">
                        2 Sep 2026, 11:03
                      </time>
                    </li>
                  </ul>
                </details>
              </li>
            </ul>
          </section>
          <nav className="pagination" aria-label="Notification pages">
            <span>Showing 1 to 6 of 23</span>
            <ul className="pagination__list">
              <li>
                <a className="pagination__item" role="link" aria-disabled="true" aria-label="Previous page">
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-caret-left" />
                  </svg>
                </a>
              </li>
              <li>
                <Link
                  className="pagination__item"
                  href="/notifications"
                  aria-current="page"
                  aria-label="Page 1, current"
                >
                  1
                </Link>
              </li>
              <li>
                <Link className="pagination__item" href="/notifications" aria-label="Page 2">
                  2
                </Link>
              </li>
              <li>
                <Link className="pagination__item" href="/notifications" aria-label="Page 3">
                  3
                </Link>
              </li>
              <li>
                <Link className="pagination__item" href="/notifications" aria-label="Page 4">
                  4
                </Link>
              </li>
              <li>
                <Link className="pagination__item" href="/notifications" aria-label="Next page">
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-caret-right" />
                  </svg>
                </Link>
              </li>
            </ul>
          </nav>
          {/* ===================== Empty ===================== */}
          <p className="text-small text-muted">
            Times are South African time (SAST). Messages about results, appeals and your account are always sent and
            cannot be switched off. You can choose the others in your <Link href="/">notification preferences</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
