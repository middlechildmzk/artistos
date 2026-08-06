import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://artistos-next.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ArtistOS",
    template: "%s · ArtistOS",
  },
  description: "The opportunity intelligence engine for independent artists. Find the right playlists, radio, blogs, labels, sync opportunities, creators and industry contacts for every release.",
  applicationName: "ArtistOS",
  keywords: ["music promotion", "playlist submission", "music industry contacts", "artist marketing", "music smart link", "independent artists"],
  openGraph: {
    type: "website",
    siteName: "ArtistOS",
    title: "ArtistOS | Know where your next release belongs",
    description: "Match your music with the right playlists, radio, blogs, labels, sync opportunities, creators and industry contacts.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "ArtistOS | Know where your next release belongs",
    description: "The opportunity intelligence engine for independent artists.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
