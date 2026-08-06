import type { ReactNode } from "react";
import { MusicActivityFeedLoader } from "@/components/music-activity-feed-loader";

export default function InsightsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MusicActivityFeedLoader />
    </>
  );
}
