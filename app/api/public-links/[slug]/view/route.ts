import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cleanPublicText, loadPublicLink, recordPublicLinkEvent } from "@/lib/public-links";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const { slug } = await context.params;
  const link = await loadPublicLink(slug);
  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cookieName = `artistos_link_seen_${createHash("sha256").update(link.slug).digest("hex").slice(0, 16)}`;
  if (request.cookies.get(cookieName)?.value === "1") {
    return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  await recordPublicLinkEvent({
    link,
    eventType: "page_view",
    utmSource: cleanPublicText(body.utmSource, 160),
    utmMedium: cleanPublicText(body.utmMedium, 160),
    utmCampaign: cleanPublicText(body.utmCampaign, 160),
    referrer: request.headers.get("referer"),
    countryCode: request.headers.get("x-vercel-ip-country"),
    metadata: { collection_version: "public-link-view-v1" },
  });

  const response = new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
  response.cookies.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/l/${link.slug}`,
    maxAge: 60 * 60 * 12,
  });
  return response;
}
