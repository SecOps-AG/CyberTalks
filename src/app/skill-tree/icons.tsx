/**
 * Line icons for skill tree nodes, one per talk theme. 24×24 grid, drawn with
 * the current text color. Names match the `icon` field in data/skill-trees.json.
 */
import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  bug: (
    <>
      <rect x="8" y="7" width="8" height="12" rx="4" />
      <path d="M12 7V19M9.5 5.5 8 4M14.5 5.5 16 4M8 11H4M16 11h4M8 15.5l-3.5 2M16 15.5l3.5 2M8 9 5 7M16 9l3-2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.6 2.6 3.8 5.4 3.8 8.5s-1.2 5.9-3.8 8.5c-2.6-2.6-3.8-5.4-3.8-8.5s1.2-5.9 3.8-8.5Z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3M12 14.5v2.5" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 7.7-1.5M12 14.5v2.5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12 19.5 3.5M16.5 6.5l2.5 2.5M14 9l2 2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6Z" />
      <path d="m8.8 12 2.2 2.2 4.3-4.4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.4 7.4A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 4.6-1.2" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3.5 3.5l17 17" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5.5 5.5" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
      <path d="m7 9.5 3 2.5-3 2.5M12 15h5" />
    </>
  ),
  skull: (
    <>
      <path d="M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4 2.8 5v3.5h9.4V15.5c1.7-1 2.8-2.6 2.8-5 0-4-3.1-7-7.5-7Z" />
      <circle cx="9" cy="11" r="1.6" />
      <circle cx="15" cy="11" r="1.6" />
      <path d="M10.5 19v-2M13.5 19v-2" />
    </>
  ),
  ransom: (
    <>
      <path d="M6 3h8l4 4v5M6 3v18h6" />
      <path d="M14 3v4h4" />
      <rect x="14" y="16" width="7" height="5" rx="1" />
      <path d="M15.5 16v-1.5a2 2 0 0 1 4 0V16" />
    </>
  ),
  cloud: <path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6A3.8 3.8 0 0 1 17.5 18.5Z" />,
  container: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </>
  ),
  package: (
    <>
      <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4Z" />
      <path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9M7.8 5.5l8.5 4" />
    </>
  ),
  server: (
    <>
      <rect x="4" y="4" width="16" height="6.5" rx="1.2" />
      <rect x="4" y="13.5" width="16" height="6.5" rx="1.2" />
      <path d="M7.5 7.25h.01M7.5 16.75h.01M11 7.25h5M11 16.75h5" />
    </>
  ),
  network: (
    <>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5" cy="18.5" r="2.2" />
      <circle cx="19" cy="18.5" r="2.2" />
      <path d="M11 7 6 16.6M13 7l5 9.6M7.2 18.5h9.6" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" />
      <circle cx="12" cy="19.3" r="0.9" />
    </>
  ),
  bluetooth: (
    <>
      <rect x="3" y="8" width="5" height="9" rx="1" />
      <rect x="16" y="8" width="5" height="9" rx="1" />
      <path d="M10 10.5a3 3 0 0 1 4 0M9 8a6 6 0 0 1 6 0M10 14.5h4" />
    </>
  ),
  radio: (
    <>
      <path d="M12 10.5 8 21M12 10.5l4 10.5M9.5 17h5" />
      <circle cx="12" cy="9" r="1.5" />
      <path d="M8.5 5.5a5 5 0 0 0 0 7M15.5 5.5a5 5 0 0 1 0 7M5.8 3a8.5 8.5 0 0 0 0 12M18.2 3a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  satellite: (
    <>
      <rect x="9.5" y="9.5" width="5" height="5" transform="rotate(45 12 12)" />
      <path d="M8.2 8.2 4.5 4.5M6.5 2.8 2.8 6.5M15.8 15.8l3.7 3.7M17.5 21.2l3.7-3.7" />
      <path d="M4 14a6 6 0 0 0 6 6" />
    </>
  ),
  chip: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <path d="M9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21" />
    </>
  ),
  car: (
    <>
      <path d="M3.5 16v-3.5l2-5h13l2 5V16Z" />
      <path d="M3.5 12.5h17" />
      <circle cx="7.5" cy="16.5" r="1.8" />
      <circle cx="16.5" cy="16.5" r="1.8" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2" />
      <path d="M10.5 5h3M11.5 18.5h1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c.8-4 3.7-6.5 7.5-6.5s6.7 2.5 7.5 6.5" />
    </>
  ),
  mask: (
    <>
      <path d="M2.5 9.5c3-1.5 6-1.5 9.5 0 3.5-1.5 6.5-1.5 9.5 0-.3 4.5-2.6 7-5.5 7-2 0-3-1.5-4-3-1 1.5-2 3-4 3-2.9 0-5.2-2.5-5.5-7Z" />
      <path d="M6 11.5h3M15 11.5h3" />
    </>
  ),
  hook: (
    <>
      <circle cx="13" cy="4" r="1.5" />
      <path d="M13 5.5V15a4.5 4.5 0 0 1-9 0v-2.5l3 2.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  call: (
    <path d="M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />
  ),
  brain: (
    <>
      <path d="M12 5a3 3 0 0 0-5.5-1.5A3 3 0 0 0 4 8a3.5 3.5 0 0 0 .5 6.5A3.2 3.2 0 0 0 8 19a3 3 0 0 0 4 1.5" />
      <path d="M12 5a3 3 0 0 1 5.5-1.5A3 3 0 0 1 20 8a3.5 3.5 0 0 1-.5 6.5A3.2 3.2 0 0 1 16 19a3 3 0 0 1-4 1.5V5" />
      <path d="M8 9.5a2.5 2.5 0 0 1 2.5 2M16 9.5a2.5 2.5 0 0 0-2.5 2" />
    </>
  ),
  robot: (
    <>
      <rect x="5" y="8" width="14" height="11" rx="2" />
      <path d="M12 8V4.5M3 12.5v3M21 12.5v3M9.5 16h5" />
      <circle cx="12" cy="3.8" r="0.9" />
      <circle cx="9.3" cy="12.2" r="1.2" />
      <circle cx="14.7" cy="12.2" r="1.2" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H10l-4.5 3.5V16H4Z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  factory: (
    <>
      <path d="M3 20.5V10l5 3V10l5 3V5h3l1 15.5Z" />
      <path d="M3 20.5h18M17 20.5V12h4v8.5M7 17h1.5M11 17h1.5" />
    </>
  ),
  power: <path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6Z" />,
  branch: (
    <>
      <circle cx="6.5" cy="5" r="2" />
      <circle cx="6.5" cy="19" r="2" />
      <circle cx="17.5" cy="7" r="2" />
      <path d="M6.5 7v10M17.5 9c0 4.5-6 4-11 8" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21.5V3.5" />
      <path d="M5 4.5h12l-2.5 4 2.5 4H5" />
    </>
  ),
  "flag-world": (
    <>
      <circle cx="11" cy="13.5" r="7.5" />
      <path d="M3.5 13.5h15M11 6c2.2 2.2 3 4.7 3 7.5s-.8 5.3-3 7.5c-2.2-2.2-3-4.7-3-7.5S8.8 8.2 11 6" />
      <path d="M17 2v6M17 2.5h4l-1 1.5 1 1.5h-4" />
    </>
  ),
  cap: (
    <>
      <path d="M2 9.5 12 4.5l10 5-10 5Z" />
      <path d="M6 11.5v4.5c3.5 2.5 8.5 2.5 12 0v-4.5M21 10v5.5" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </>
  ),
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4.5l-4 15" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      <circle cx="12" cy="12" r="6.5" />
    </>
  ),
  fingerprint: (
    <path d="M6.5 6.5A7.5 7.5 0 0 1 19.5 11v2M4.5 11a7.5 7.5 0 0 1 .7-3M8.5 20a14 14 0 0 1-1-5.5v-3a4.5 4.5 0 0 1 9 0v2.5M12 11.5V15a12 12 0 0 0 1.5 6M16.5 17a17 17 0 0 0 .4 3.5M4.5 15.5V14" />
  ),
  layers: (
    <>
      <path d="m12 3 9 4.5-9 4.5-9-4.5Z" />
      <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
    </>
  ),
  money: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21.5s-6.5-6-6.5-11.5a6.5 6.5 0 0 1 13 0c0 5.5-6.5 11.5-6.5 11.5Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  id: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="1.5" />
      <circle cx="8.5" cy="11" r="2.2" />
      <path d="M5 16.5c.6-2 2-3 3.5-3s2.9 1 3.5 3M14.5 9.5H19M14.5 13H19" />
    </>
  ),
  siren: (
    <>
      <path d="M6.5 17v-5a5.5 5.5 0 0 1 11 0v5" />
      <path d="M4 17h16v3.5H4ZM12 2.5v2M4 5.5l1.5 1.5M20 5.5 18.5 7M12 12v2" />
    </>
  ),
  logs: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M7 8h6M7 12h10M7 16h4M15.5 8h1.5M13.5 16H17" />
    </>
  ),
  camera: (
    <>
      <path d="M3 7.5 16 4l1.5 5.5L4.5 13Z" />
      <path d="M10.5 11.5 12 16H6.5M6.5 13.5v6M17 7.5l3.5-1" />
    </>
  ),
  usb: (
    <>
      <rect x="7.5" y="9" width="9" height="12.5" rx="1" />
      <path d="M9 9V2.5h6V9M10.8 5h.01M13.2 5h.01" />
    </>
  ),
  door: (
    <>
      <path d="M5.5 21.5V3h13v18.5M3 21.5h18" />
      <circle cx="15" cy="12.5" r="1" />
    </>
  ),
  binary: (
    <>
      <rect x="3.5" y="4" width="5" height="7" rx="2.5" />
      <path d="M13 4.5 15 4v7M13 11h4M5.5 13l2-.5v7.5M3.5 20h6" />
      <rect x="14" y="13" width="5" height="7" rx="2.5" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3.5v17M7 20.5h10M5 7h14M5 7l-3 7h6ZM19 7l-3 7h6Z" />
      <path d="M2 14a3 3 0 0 0 6 0M16 14a3 3 0 0 0 6 0" />
    </>
  ),
};

export const ICON_NAMES = Object.keys(ICONS);

/** One line icon. Unknown names fall back to an empty socket. */
export function TalkIcon({ name, className }: { name?: string; className?: string }) {
  const body = name ? ICONS[name] : undefined;
  if (!body) return <span className={className} data-empty="true" aria-hidden="true" />;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}
