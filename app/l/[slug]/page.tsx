import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicLinkShareActions } from "@/components/public-link-share-actions";
import { PublicLinkTracker } from "@/components/public-link-tracker";
import { cleanPublicText, loadPublicLink } from "@/lib/public-links";
import { musicServiceLabel } from "@/lib/smart-links/services";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { capturePublicLinkFan } from "./actions";
import styles from "./public-link.module.css";

export const dynamic = "force-dynamic";

function releaseDateLabel(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function validArtworkUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function trackedDestinationHref(args: {
  slug: string;
  destinationId: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}) {
  const params = new URLSearchParams();
  if (args.utmSource) params.set("utm_source", args.utmSource);
  if (args.utmMedium) params.set("utm_medium", args.utmMedium);
  if (args.utmCampaign) params.set("utm_campaign", args.utmCampaign);
  const query = params.toString();
  return `/l/${args.slug}/go/${args.destinationId}${query ? `?${query}` : ""}`;
}

function PublicLinkUnavailable() {
  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="release-link-unavailable">
        <div className={styles.artwork}><span aria-hidden="true">A</span></div>
        <p className={styles.eyebrow}>ArtistOS Link</p>
        <h1 id="release-link-unavailable">Release link temporarily unavailable</h1>
        <p className={styles.description}>This artist-owned release page is not connected to its secure data service yet. No listening destination or fan information has been exposed.</p>
        <footer className={styles.footer}>
          <Link href="/free-music-smart-link">Powered by ArtistOS</Link>
          <span>Try again later</span>
        </footer>
      </section>
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!hasSupabaseAdminConfig()) {
    return {
      title: "Release link temporarily unavailable · ArtistOS",
      description: "This ArtistOS release link is temporarily unavailable.",
      robots: { index: false, follow: false },
    };
  }

  const { slug } = await params;
  const link = await loadPublicLink(slug);
  if (!link) return { title: "Release not found · ArtistOS" };
  const title = `${link.artistName} · ${link.releaseTitle}`;
  const description = link.description ?? `Listen to ${link.releaseTitle} by ${link.artistName}.`;
  const artworkUrl = validArtworkUrl(link.artworkUrl);
  return {
    title,
    description,
    alternates: { canonical: "/l/" + link.slug },
    openGraph: {
      type: "website",
      title,
      description,
      url: "/l/" + link.slug,
      images: artworkUrl ? [{ url: artworkUrl, alt: title }] : [{ url: "/l/" + link.slug + "/opengraph-image", alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: artworkUrl ? [artworkUrl] : ["/l/" + link.slug + "/opengraph-image"],
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!hasSupabaseAdminConfig()) return <PublicLinkUnavailable />;

  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const link = await loadPublicLink(slug);
  if (!link) notFound();

  const utmSource = cleanPublicText(query.utm_source, 160);
  const utmMedium = cleanPublicText(query.utm_medium, 160);
  const utmCampaign = cleanPublicText(query.utm_campaign, 160);
  const signup = cleanPublicText(query.signup, 20);
  const releaseDate = releaseDateLabel(link.releaseDate);
  const title = `${link.releaseTitle}${link.featuredArtist ? ` (feat. ${link.featuredArtist})` : ""}`;
  const artworkUrl = validArtworkUrl(link.artworkUrl);
  const recordingJsonLd = {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    name: link.releaseTitle,
    byArtist: { "@type": "MusicGroup", name: link.artistName },
    datePublished: link.releaseDate || undefined,
    image: artworkUrl || undefined,
    url: "/l/" + link.slug,
  };

  return (
    <main className={styles.shell}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(recordingJsonLd) }} />
      <PublicLinkTracker slug={link.slug} />
      <section className={styles.card} aria-labelledby="release-title">
        <div className={styles.artwork}>
          {artworkUrl ? <Image alt={title + " cover artwork"} fill priority sizes="(max-width: 620px) 76vw, 340px" src={artworkUrl} /> : <span aria-hidden="true">{link.releaseTitle.slice(0, 1).toUpperCase()}</span>}
        </div>
        <p className={styles.eyebrow}>{link.mode === "presave" ? "Upcoming release" : "Out now"}</p>
        <h1 id="release-title">{link.headline || title}</h1>
        <p className={styles.artist}>{link.artistName}</p>
        {releaseDate ? <p className={styles.date}>{releaseDate}</p> : null}
        {link.description ? <p className={styles.description}>{link.description}</p> : null}

        <PublicLinkShareActions artistName={link.artistName} title={title} />

        <div className={styles.destinationHeading}>
          <div>
            <p className={styles.eyebrow}>Choose where you listen</p>
            <h2>{link.mode === "presave" ? "Save the release" : "Play the release"}</h2>
          </div>
          <span>{link.destinations.length} {link.destinations.length === 1 ? "service" : "services"}</span>
        </div>

        <div className={styles.destinations} aria-label="Choose a music service">
          {link.destinations.length ? link.destinations.map((destination) => (
            <a
              className={styles.destination}
              href={trackedDestinationHref({
                slug: link.slug,
                destinationId: destination.id,
                utmSource,
                utmMedium,
                utmCampaign,
              })}
              key={destination.id}
              rel="nofollow"
            >
              <span className={styles.destinationIdentity}><i aria-hidden="true">{musicServiceLabel(destination.service).slice(0, 1)}</i>{musicServiceLabel(destination.service)}</span>
              <strong>{link.mode === "presave" ? "Choose service" : "Listen"}</strong>
            </a>
          )) : <div className={styles.empty}>Streaming destinations are being added.</div>}
        </div>

        {link.captureEmail ? (
          <section className={styles.capture} aria-labelledby="fan-capture-title">
            <p className={styles.eyebrow}>Stay connected</p>
            <h2 id="fan-capture-title">Get the next release update</h2>
            <p>Join {link.artistName}&apos;s artist-owned list. Your address is not sold to advertisers.</p>

            {signup === "success" ? <div className={`${styles.notice} ${styles.success}`} role="status">You&apos;re on the list. Check your inbox when confirmation is enabled.</div> : null}
            {signup === "invalid" ? <div className={styles.notice} role="alert">Enter a valid email and accept both consent choices.</div> : null}
            {signup === "unavailable" ? <div className={styles.notice} role="alert">Fan signup is unavailable for this link.</div> : null}

            {signup !== "success" ? (
              <form action={capturePublicLinkFan} className={styles.form}>
                <input type="hidden" name="slug" value={link.slug} />
                <input type="hidden" name="utmSource" value={utmSource} />
                <input type="hidden" name="utmMedium" value={utmMedium} />
                <input type="hidden" name="utmCampaign" value={utmCampaign} />
                <label>
                  <span>First name <small>optional</small></span>
                  <input name="firstName" autoComplete="given-name" maxLength={80} />
                </label>
                <label>
                  <span>Email</span>
                  <input name="email" type="email" autoComplete="email" inputMode="email" maxLength={320} required />
                </label>
                <label className={styles.check}>
                  <input name="emailConsent" type="checkbox" required />
                  <span>I agree to receive release and artist updates by email. I can unsubscribe at any time.</span>
                </label>
                <label className={styles.check}>
                  <input name="privacyAcknowledged" type="checkbox" required />
                  <span>I acknowledge the privacy notice and consent record for this signup.</span>
                </label>
                <button type="submit">Join the list</button>
              </form>
            ) : null}
          </section>
        ) : null}

        <footer className={styles.footer}>
          <Link href="/free-music-smart-link">Powered by ArtistOS</Link>
          <span>Artist-owned fan connection</span>
        </footer>
      </section>
    </main>
  );
}
