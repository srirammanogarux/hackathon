import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

export const Heart = (p: P) => (
  <Svg {...p}>
    <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" />
  </Svg>
);
export const Comment = (p: P) => (
  <Svg {...p}>
    <path d="M20.6 16.4A9 9 0 1 0 17 20l3.9 1-.3-4.6Z" />
  </Svg>
);
export const Send = (p: P) => (
  <Svg {...p}>
    <path d="M21.5 3 10 13.2" />
    <path d="M21.5 3 15 21l-5-7.8L2.5 9 21.5 3Z" />
  </Svg>
);
export const Repost = (p: P) => (
  <Svg {...p}>
    <path d="M17 3l3 3-3 3" />
    <path d="M4 12V9a3 3 0 0 1 3-3h13" />
    <path d="M7 21l-3-3 3-3" />
    <path d="M20 12v3a3 3 0 0 1-3 3H4" />
  </Svg>
);
export const Dots = (p: P) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="19" cy="12" r="1.3" fill="currentColor" />
  </Svg>
);
export const Camera = (p: P) => (
  <Svg {...p}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.5-2h6.6l1.5 2h1.7A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z" />
    <circle cx="12" cy="13" r="3.6" />
  </Svg>
);
export const Back = (p: P) => (
  <Svg {...p}>
    <path d="M15 4.5 7.5 12l7.5 7.5" />
  </Svg>
);
export const Chevron = (p: P) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);
export const Compose = (p: P) => (
  <Svg {...p}>
    <path d="M20 12.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6.5" />
    <path d="M17.6 3.4a2 2 0 0 1 2.9 2.9L12 14.8l-3.6.8.8-3.6 8.4-8.6Z" />
  </Svg>
);
export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20.5 20.5-4.5-4.5" />
  </Svg>
);
export const Phone = (p: P) => (
  <Svg {...p}>
    <path d="M5 3.5h3.2l1.6 4.2-2 1.3a11 11 0 0 0 7.2 7.2l1.3-2 4.2 1.6V19a2 2 0 0 1-2.2 2A17 17 0 0 1 3 5.7 2 2 0 0 1 5 3.5Z" />
  </Svg>
);
export const Video = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="6" width="13" height="12" rx="3" />
    <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
  </Svg>
);
export const Mic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
  </Svg>
);
export const ImageIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="8.5" cy="8.5" r="1.6" />
    <path d="m21 15-5-5-9 11" />
  </Svg>
);
export const Sticker = (p: P) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-9-9h4.5L21 7.5V12Z" />
    <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
    <circle cx="9" cy="10" r=".8" fill="currentColor" />
    <circle cx="15" cy="10" r=".8" fill="currentColor" />
  </Svg>
);
export const Plus = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v16M4 12h16" />
  </Svg>
);
export const Home = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6.5H9V21H4.5a1 1 0 0 1-1-1v-9.5Z" />
  </Svg>
);
export const ReelsTab = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path d="M3 8.5h18M8.5 3l3 5.5M14.5 3l3 5.5" />
    <path d="m10.3 12.3 4.2 2.4-4.2 2.4v-4.8Z" fill="currentColor" />
  </Svg>
);
export const Profile = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3.2" />
    <path d="M6.2 18.4a6.5 6.5 0 0 1 11.6 0" />
  </Svg>
);
export const Music = (p: P) => (
  <Svg {...p}>
    <path d="M9 18V5.5l11-2V16" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Svg>
);
export const Clock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const Check = (p: P) => (
  <Svg {...p}>
    <path d="m4.5 12.5 5 5L20 7" />
  </Svg>
);
export const Pause = (p: P) => (
  <Svg {...p}>
    <path d="M8 5v14M16 5v14" />
  </Svg>
);
export const Play = (p: P) => (
  <Svg {...p}>
    <path d="M7 4.5v15l12.5-7.5L7 4.5Z" fill="currentColor" />
  </Svg>
);
export const Grid = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </Svg>
);
export const Bag = (p: P) => (
  <Svg {...p}>
    <path d="M5 8h14l-1 12.5a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9L5 8Z" />
    <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
  </Svg>
);

/** Two-tick read receipt used in WhatsApp bubbles. */
export function DoubleTick({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" className={className} aria-hidden>
      <path d="m1 5.8 3 3L10.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m6.5 8.8 1 0L15 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Simple IG-style gradient glyph. Not the real logo. */
export function IgGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id="v2ig" cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#FDF497" />
          <stop offset=".1" stopColor="#FDF497" />
          <stop offset=".5" stopColor="#FD5949" />
          <stop offset=".68" stopColor="#D6249F" />
          <stop offset="1" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill="url(#v2ig)" />
      <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.4" cy="7.6" r="1" fill="#fff" />
    </svg>
  );
}

/** Simple chat-bubble glyph in WhatsApp green. Not the real logo. */
export function WaGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6.5" fill="#25D366" />
      <path d="M12 5.2a6.8 6.8 0 0 0-5.9 10.2L5.2 18.8l3.5-.9A6.8 6.8 0 1 0 12 5.2Z" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.7 9.4c.2 1.9 2.4 4.2 4.6 4.8l.9-1-1.2-.7-.5.5c-.8-.3-1.6-1.1-1.9-1.9l.5-.5-.7-1.2-1 .9-.7-.9Z" fill="#fff" />
    </svg>
  );
}
