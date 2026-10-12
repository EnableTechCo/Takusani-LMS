import { INSTITUTION } from "@/config/institution";

/**
 * The iNurture mark: a leaf whose vein is a cut-out "i" with its dot near the tip, drawn after the institution's logo.
 * The cut-outs show whatever is behind it, so it reads on both themes. Replace with the official vector logo when
 * iNurture supplies one.
 */
export function BrandMark({ className = "brand__mark" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 32 32">
      <path
        d="M16 2C24.5 8.5 27 18 22.6 25.4C20.2 29.6 11.8 29.6 9.4 25.4C5 18 7.5 8.5 16 2ZM14.5 14.25A1.5 1.5 0 0 1 17.5 14.25V24.25A1.5 1.5 0 0 1 14.5 24.25ZM14.1 9.6A1.9 1.9 0 1 0 17.9 9.6A1.9 1.9 0 1 0 14.1 9.6Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

/** Mark and wordmark. Place inside a link or a heading; the name is read from the text. */
export function Brand() {
  return (
    <>
      <BrandMark />
      <span className="brand__name">{INSTITUTION.name}</span>
      <span className="brand__suffix">LMS</span>
    </>
  );
}
