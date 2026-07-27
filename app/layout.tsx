import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArtistOS",
  description: "Release operations, campaign intelligence, and audience workflows for independent artists.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
