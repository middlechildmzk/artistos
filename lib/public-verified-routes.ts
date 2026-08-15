export type PublicVerifiedRoute = {
  name: string;
  lane: "radio" | "press" | "sync";
  type: string;
  status: string;
  route: string;
  requirements: string;
  checked: string;
  source: string;
};

export const publicVerifiedRoutes: PublicVerifiedRoute[] = [
  {
    name: "KEXP",
    lane: "radio",
    type: "Radio",
    status: "Open",
    route: "Digital submission email",
    requirements: "Send streaming/download links to md@kexp.org. Do not send attachments.",
    checked: "August 13, 2026",
    source: "https://www.kexp.org/about/submission-guidelines/",
  },
  {
    name: "KCSU 90.5 FM",
    lane: "radio",
    type: "College radio",
    status: "Open",
    route: "Official submission form",
    requirements: "Use the current digital submission form. music@kcsufm.com is listed for music-department contact.",
    checked: "August 13, 2026",
    source: "https://kcsufm.com/submitmusic/",
  },
  {
    name: "KJHK 90.7 FM",
    lane: "radio",
    type: "College radio",
    status: "Open",
    route: "Digital submission email",
    requirements: "Current electronic submission route: submitmusic@kjhk.org.",
    checked: "August 13, 2026",
    source: "https://kjhk.org/web/submit-music/",
  },
  {
    name: "KALX 90.7 FM",
    lane: "radio",
    type: "College radio",
    status: "Open with restrictions",
    route: "Physical mail",
    requirements: "Professionally pressed CDs or LPs only. Current instructions reject digital submissions and streaming/download links.",
    checked: "August 13, 2026",
    source: "https://www.kalx.berkeley.edu/about/contact/",
  },
  {
    name: "Radio K (KUOM)",
    lane: "radio",
    type: "College radio",
    status: "Open",
    route: "Physical or digital",
    requirements: "Accepts physical releases and digital submissions through the Music Department workflow; digital submissions should use downloadable files or supported download links.",
    checked: "August 13, 2026",
    source: "https://radiok.org/submitting-music",
  },
  {
    name: "CFRU 93.3 FM",
    lane: "radio",
    type: "Community radio",
    status: "Open with eligibility rules",
    route: "Digital music department",
    requirements: "General digital submissions should be an EP or album with at least three distinct songs. Download links are preferred; high-quality MP3s are recommended.",
    checked: "August 13, 2026",
    source: "https://www.cfru.ca/music/",
  },
  {
    name: "Electric Hawk",
    lane: "press",
    type: "Electronic music press",
    status: "Open",
    route: "Official feature form",
    requirements: "Current Get Featured workflow accepts music for editorial consideration, social support, and playlist consideration through the official form.",
    checked: "August 13, 2026",
    source: "https://theelectrichawk.com/get-featured-on-electric-hawk/",
  },
  {
    name: "Magnetic Magazine",
    lane: "press",
    type: "Music publication / label",
    status: "Open",
    route: "Separate editorial and demo routes",
    requirements: "Editorial music goes to the publication's current music-review inbox; label demos use the separate Magnetic Magazine Recordings demo inbox.",
    checked: "August 13, 2026",
    source: "https://magneticmag.com/contact/",
  },
  {
    name: "ThinkSync Music",
    lane: "sync",
    type: "Sync / music supervision",
    status: "Open with eligibility rules",
    route: "Dedicated submissions inbox",
    requirements: "Commercially released artists can submit a small set of MP3s by download link to the supervision submissions route; placement/publishing submissions use a separate inbox.",
    checked: "August 13, 2026",
    source: "https://thinksyncmusic.com/contact/submissions/",
  },
];

export function routesByLane(lane: PublicVerifiedRoute["lane"]) {
  return publicVerifiedRoutes.filter((route) => route.lane === lane);
}
