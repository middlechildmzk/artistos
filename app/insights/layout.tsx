import type { ReactNode } from "react";
import { MusicActivityFeedLoader } from "@/components/music-activity-feed-loader";
import { SoundchartsReleasePilotCard } from "@/components/soundcharts-release-pilot-card";

export default function InsightsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <MusicActivityFeedLoader />
      <SoundchartsReleasePilotCard />
    </>
  );
}
