import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, DM_Sans, Caveat, Noto_Sans_Tamil, Noto_Sans_Kannada, Noto_Sans_Telugu, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: ["600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dmsans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans", weight: ["400", "500", "600", "700"] });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-script", weight: ["600"] });
const tamil = Noto_Sans_Tamil({ subsets: ["tamil"], variable: "--font-tamil", weight: ["400", "600", "700"] });
const kannada = Noto_Sans_Kannada({ subsets: ["kannada"], variable: "--font-kannada", weight: ["400", "600", "700"] });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--font-telugu", weight: ["400", "600", "700"] });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "Reels Magic · post like you have a team",
  description: "Reels Magic: your AI content team plans, writes and edits your Reels. Built for Indian small businesses and first-time creators.",
  applicationName: "Reels Magic",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-180.png" },
  appleWebApp: { capable: true, title: "Reels Magic", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#FFFFFF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fonts = [bricolage, inter, dmsans, caveat, tamil, kannada, telugu, deva].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={fonts}>
      <body>{children}</body>
    </html>
  );
}
