/**
 * The icon set from docs/design/ui/prototype/assets/ui.js: a 24px grid with 2.4px round strokes (Phosphor Bold
 * weight). The sprite is rendered once in the root layout; use an icon with <Icon name="check" /> or, in ported
 * markup, <svg className="icon" aria-hidden="true"><use href="#i-check" /></svg>.
 */
export const ICONS = {
  check: "M4.5 12.5l5 5 10-11",
  x: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  warning: "M12 3.5L2.5 20h19L12 3.5zM12 10v4.5M12 17.4v.1",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.1",
  "alert-circle": "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v6M12 16.5v.1",
  "check-circle": "M12 21a9 9 0 100-18 9 9 0 000 18zM8 12.5l3 3 5-6",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2",
  calendar: "M4 6.5h16V20H4zM4 10.5h16M8 3.5v4M16 3.5v4",
  lock: "M6 10.5h12V20H6zM8.5 10.5v-3a3.5 3.5 0 017 0v3",
  "cloud-check": "M7 18.5a4.5 4.5 0 01-.6-8.96A6 6 0 0118 8.5a5 5 0 01-.5 10H7zM9.5 13.5l2 2 3.5-4",
  offline:
    "M3 3l18 18M5 12.5a10 10 0 013.5-2.3M2 8.8a15 15 0 014-2.6M10.5 5.1A15 15 0 0122 8.8M19 12.5a10 10 0 00-3-2M8.5 16a5 5 0 017 0M12 19.5v.1",
  device: "M7 3.5h10v17H7zM11 17.5h2",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  download: "M12 4v12M7 11l5 5 5-5M4 16v4h16v-4",
  file: "M6 3.5h8l4 4v13H6zM14 3.5v4h4",
  paperclip: "M19 11.5l-7.5 7.5a4.5 4.5 0 01-6.4-6.4L13 4.7a3 3 0 014.3 4.3l-7.6 7.6a1.5 1.5 0 01-2.1-2.1L14 8",
  menu: "M4 6.5h16M4 12h16M4 17.5h16",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  "caret-down": "M6 9l6 6 6-6",
  "caret-up": "M6 15l6-6 6 6",
  "caret-right": "M9 6l6 6-6 6",
  "caret-left": "M15 6l-6 6 6 6",
  "arrow-right": "M4 12h16M14 6l6 6-6 6",
  "arrow-left": "M20 12H4M10 6l-6 6 6 6",
  search: "M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM15.5 15.5L20 20",
  filter: "M4 5h16l-6 7.5V19l-4 1.5v-8L4 5z",
  sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M16 4.5v5M8 14.5v5",
  bell: "M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15l1.5-2zM10 21h4",
  megaphone: "M4 10v4l3 .5 9 4.5V5L7 9.5 4 10zM19 9.5a3 3 0 010 5M8 14.5l1 5h3l-1-4",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5a7.5 7.5 0 0115 0",
  users:
    "M9 12a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 5.2a3.5 3.5 0 010 6.6M18 14.2a6.5 6.5 0 013.5 5.8",
  house: "M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z",
  book: "M4 5h6a2 2 0 012 2v13a2 2 0 00-2-2H4zM20 5h-6a2 2 0 00-2 2v13a2 2 0 012-2h6z",
  clipboard: "M8 5H6v15.5h12V5h-2M8 3.5h8V7H8zM9 12h6M9 16h6",
  inbox: "M4 13l2.5-8h11L20 13v6.5H4zM4 13h5l1 2.5h4l1-2.5h5",
  pencil: "M4 20l1-4.5L16.5 4 20 7.5 8.5 19 4 20zM14 6.5l3.5 3.5",
  scales: "M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a2.8 2.8 0 005 0L5 7zM19 7l-2.5 6a2.8 2.8 0 005 0L19 7z",
  chart: "M4 20h16M7 20v-7M12 20V5M17 20V10",
  note: "M5 4h14v10l-6 6H5zM19 14h-6v6",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  printer: "M7 8V3.5h10V8M7 17H4V8h16v9h-3M7 14h10v6.5H7z",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  refresh: "M19.5 12a7.5 7.5 0 01-13.3 4.8M4.5 12a7.5 7.5 0 0113.3-4.8M18 3.5v4h-4M6 20.5v-4h4",
  pause: "M8 5v14M16 5v14",
  play: "M7 4.5v15l12-7.5z",
  trash: "M4 6.5h16M9 6.5V4h6v2.5M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6",
  external: "M13 4h7v7M20 4l-9 9M18 14v6H4V6h6",
  "sign-out": "M10 4H5v16h5M14 8l4 4-4 4M18 12H9",
  sun: "M12 16a4 4 0 100-8 4 4 0 000 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  moon: "M20 14.5A8.5 8.5 0 119.5 4 6.5 6.5 0 0020 14.5z",
  "shield-warning": "M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3zM12 8v5M12 16.4v.1",
  flag: "M5 21V4M5 4.5h13l-2.5 4.5 2.5 4.5H5",
  video: "M3 6.5h12v11H3zM15 10.5l6-3.5v10l-6-3.5",
  bookmark: "M6 3.5h12v17l-6-4.5-6 4.5z",
  laptop: "M5 5h14v10H5zM2.5 19h19",
  archive: "M3.5 4.5h17v4h-17zM5 8.5V20h14V8.5M10 12.5h4",
  help: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.2-1.5 2.2M12 17v.1",
  grid: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
} as const;

export type IconName = keyof typeof ICONS;

export function IconSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      id="takusani-icons"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {Object.entries(ICONS).map(([name, d]) => (
        <symbol id={`i-${name}`} key={name} viewBox="0 0 24 24">
          <path d={d} />
        </symbol>
      ))}
    </svg>
  );
}

/** A decorative icon. Give the surrounding control an accessible name; the icon itself is hidden. */
export function Icon({ name, className = "icon" }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" className={className}>
      <use href={`#i-${name}`} />
    </svg>
  );
}
