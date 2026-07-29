import { NextRequest, NextResponse } from "next/server";
import { loadPublicLink, recordPublicLinkEvent } from "@/lib/public-links";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string; destinationId: string }> },
) {
  const { slug, destinationId } = await context.params;
  const link = await loadPublicLink(slug);
  if (!link) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const destination = link.destinations.find((item) => item.id === destinationId);
  if (!destination) return NextResponse.json({ error: "destination_not_found" }, { status: 404 });

  let destinationUrl: URL;
  try {
    destinationUrl = new URL(destination.url);
  } catch {
    return NextResponse.json({ error: "invalid_destination" }, { status: 404 });
  }
  if (!['http:', 'https:'].includes(destinationUrl.protocol)) {
    return NextResponse.json({ error: "invalid_destination" }, { status: 404 });
  }

  await recordPublicLinkEvent({
    link,
    eventType: "destination_click",
    destinationService: destination.service,
    utmSource: request.nextUrl.searchParams.get("utm_source"),
    utmMedium: request.nextUrl.searchParams.get("utm_medium"),
    utmCampaign: request.nextUrl.searchParams.get("utm_campaign"),
    referrer: request.headers.get("referer"),
    countryCode: request.headers.get("x-vercel-ip-country"),
    metadata: { collection_version: "public-link-click-v1" },
  });

  return NextResponse.redirect(destinationUrl, { status: 307 });
}
