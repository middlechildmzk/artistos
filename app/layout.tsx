import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ArtistOS",
    template: "%s · ArtistOS",
  },
  description: "An evidence-first operating system for independent artists: releases, opportunities, campaigns, audience, approvals, and Artist Brain.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
