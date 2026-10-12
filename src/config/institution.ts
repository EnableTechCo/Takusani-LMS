/**
 * The institution this deployment serves, and its brand. Each institution gets its own copy of the LMS (separate
 * database and site), so these values are per deployment. Read them only from here so a change touches one file.
 * The help address is still an example: replace it with the institution's support mailbox before go-live.
 */
export const INSTITUTION = {
  name: "iNurture",
  /** The product name: browser titles, the calendar feed, the home link's label. */
  product: "iNurture LMS",
  website: "https://inurture.co.za",
  helpEmail: "help@example.org",
} as const;
