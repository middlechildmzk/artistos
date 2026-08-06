import { ImageResponse } from "next/og";
import { loadPublicLink } from "@/lib/public-links";

export const alt = "ArtistOS music release";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = await loadPublicLink(slug);
  const artist = link?.artistName ?? "ArtistOS";
  const title = link?.releaseTitle ?? "Music release";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "70px",
          position: "relative",
          overflow: "hidden",
          background: "#090a10",
          color: "#f7f8ff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ width: 520, height: 520, position: "absolute", top: -220, left: -140, borderRadius: "50%", background: "rgba(124,99,255,.32)" }} />
        <div style={{ width: 460, height: 460, position: "absolute", right: -180, bottom: -240, borderRadius: "50%", background: "rgba(77,163,255,.22)" }} />
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 920, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 58, color: "#b6adff", fontSize: 25, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
            <span style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, background: "linear-gradient(135deg,#7c63ff,#4da3ff)", color: "white", fontSize: 22 }}>A</span>
            ArtistOS Music Link
          </div>
          <div style={{ fontSize: 82, lineHeight: .97, fontWeight: 850, letterSpacing: -5 }}>{title}</div>
          <div style={{ marginTop: 27, color: "#b4bacd", fontSize: 34 }}>{artist}</div>
          <div style={{ marginTop: 48, color: "#7d8497", fontSize: 22 }}>Choose where to listen</div>
        </div>
      </div>
    ),
    size,
  );
}
