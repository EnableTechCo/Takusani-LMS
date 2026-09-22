import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * Data tables (design system 4.5). From 768px a real table; below it a real list of cards, one per row, with each
 * cell as a label and value (the design system's production note: restyling a table as blocks drops its semantics
 * in some browsers). Two-dimensional tables such as the audit log set `cards={false}` and scroll sideways inside a
 * focusable, labelled region instead. Sorting and paging are links, so they work on the server and can be shared.
 */

export type SortDirection = "ascending" | "descending" | "none";

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** The row's name: a row header in the table, the card title on phones. One column per table. */
  primary?: boolean;
  /** Right-aligned, tabular figures. */
  numeric?: boolean;
  /** Row actions: no visible header; a full-width button at the foot of the card on phones. */
  actions?: boolean;
  /** A sortable column: its current direction and the link that sorts by it. */
  sort?: { direction: SortDirection; href: string };
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  cards = true,
  stickyHeader,
  compact,
}: {
  /** What the table lists and in what order, for example "Accounts, by name. Times in SAST." */
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  cards?: boolean;
  stickyHeader?: boolean;
  compact?: boolean;
}) {
  const table = (
    <table className={cx("table", compact && "table--compact")}>
      <caption className="u-visually-hidden">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              aria-sort={column.sort && column.sort.direction !== "none" ? column.sort.direction : undefined}
              className={cx(column.numeric && "table__num", column.actions && "table__actions") || undefined}
              key={column.key}
              scope="col"
            >
              {column.actions ? (
                <span className="u-visually-hidden">{column.header}</span>
              ) : column.sort ? (
                <Link className="table__sort" href={column.sort.href}>
                  {column.header}
                </Link>
              ) : (
                column.header
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) =>
              column.primary ? (
                <th className="table__primary-cell" key={column.key} scope="row">
                  {column.cell(row)}
                </th>
              ) : (
                <td
                  className={cx(column.numeric && "table__num", column.actions && "table__actions") || undefined}
                  key={column.key}
                >
                  {column.cell(row)}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (!cards) {
    return (
      // A focusable region, so a keyboard user can scroll a wide table sideways.
      <div aria-label={caption} className="table-wrap" role="region" tabIndex={0}>
        {table}
      </div>
    );
  }

  const primary = columns.find((column) => column.primary);
  const details = columns.filter((column) => !column.primary && !column.actions);
  const actions = columns.filter((column) => column.actions);
  return (
    <>
      <div className={cx("table-wrap", stickyHeader && "table-wrap--sticky", "u-hide-phone")}>{table}</div>
      <ul aria-label={caption} className="stack u-phone-only">
        {rows.map((row) => (
          <li className="card" key={rowKey(row)}>
            <div className="card__body stack stack--sm">
              {primary ? <p className="card__title">{primary.cell(row)}</p> : null}
              <dl className="dl">
                {details.map((column) => (
                  <div className="dl__row" key={column.key}>
                    <dt>{column.header}</dt>
                    <dd>{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
              {actions.map((column) => (
                // A column of one: the action stretches to a full-width button, as the design system asks.
                <div className="btn-group btn-group--stack-mobile" key={column.key}>
                  {column.cell(row)}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Numbered pages, never infinite scroll. Every item is a 44px target; the current page is marked in words for
 * assistive technology, and the ends are disabled links rather than missing ones, so the layout does not jump.
 */
export function Pagination({
  label,
  page,
  pageCount,
  href,
  summary,
}: {
  /** What is being paged, for example "Queue pages". */
  label: string;
  page: number;
  pageCount: number;
  href: (page: number) => string;
  /** For example "Showing 1 to 25 of 96". */
  summary?: string;
}) {
  if (pageCount <= 1) return summary ? <p className="text-small text-muted">{summary}</p> : null;
  const pages = visiblePages(page, pageCount);
  return (
    <nav aria-label={label} className="pagination">
      {summary ? <span>{summary}</span> : null}
      <ul className="pagination__list">
        <li>
          <PageLink disabled={page <= 1} href={href(page - 1)} label="Previous page">
            <Icon className="icon icon--sm" name="caret-left" />
          </PageLink>
        </li>
        {pages.map((item, index) =>
          item === "gap" ? (
            <li aria-hidden="true" className="pagination__gap" key={`gap-${index}`}>
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                aria-current={item === page ? "page" : undefined}
                aria-label={item === page ? `Page ${item}, current` : `Page ${item}`}
                className="pagination__item"
                href={href(item)}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        <li>
          <PageLink disabled={page >= pageCount} href={href(page + 1)} label="Next page">
            <Icon className="icon icon--sm" name="caret-right" />
          </PageLink>
        </li>
      </ul>
    </nav>
  );
}

function PageLink({
  disabled,
  href,
  label,
  children,
}: {
  disabled: boolean;
  href: string;
  label: string;
  children: ReactNode;
}) {
  return disabled ? (
    <a aria-disabled="true" aria-label={label} className="pagination__item" role="link">
      {children}
    </a>
  ) : (
    <Link aria-label={label} className="pagination__item" href={href}>
      {children}
    </Link>
  );
}

/** The pages to show: the first, the last, and the current page with one either side, with gaps between. */
export function visiblePages(page: number, pageCount: number): (number | "gap")[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  sorted.forEach((p, index) => {
    if (index > 0 && p - sorted[index - 1] > 1) result.push("gap");
    result.push(p);
  });
  return result;
}
