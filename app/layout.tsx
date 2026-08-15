import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://artistos-next.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ArtistOS Network | Music Opportunity Intelligence",
    template: "%s · ArtistOS Network",
  },
  description: "Evidence-first music opportunity intelligence for independent artists: find playlists, radio, blogs, creators, labels, sync routes, and submission opportunities with provenance and verification.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
