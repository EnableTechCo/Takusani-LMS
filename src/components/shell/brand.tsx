/** The Takusani mark: a T whose crossbar carries two equal weights, a level balance (design system, brand). */
export function BrandMark({ className = "brand__mark" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 32 32">
      <path
        d="M7 0H25A7 7 0 0 1 32 7V25A7 7 0 0 1 25 32H7A7 7 0 0 1 0 25V7A7 7 0 0 1 7 0ZM7 8.5H25V12H17.75V24H14.25V12H7ZM8.25 17.5A1.75 1.75 0 1 0 11.75 17.5A1.75 1.75 0 1 0 8.25 17.5ZM20.25 17.5A1.75 1.75 0 1 0 23.75 17.5A1.75 1.75 0 1 0 20.25 17.5Z"
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
      <span className="brand__name">Takusani</span>
      <span className="brand__suffix">LMS</span>
    </>
  );
}
