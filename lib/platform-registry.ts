export type PlatformMode = 'oauth' | 'api' | 'export' | 'distributor' | 'public' | 'manual';
export type PlatformCategory = 'DSP' | 'Social' | 'Radio' | 'International' | 'Direct-to-fan' | 'Discovery';

export type MusicPlatform = {
  slug: string;
  name: string;
  category: PlatformCategory;
  modes: PlatformMode[];
  priority: 'core' | 'growth' | 'coverage';
  metrics: string[];
  notes: string;
};

export const MUSIC_PLATFORMS: MusicPlatform[] = [
  { slug:'spotify', name:'Spotify', category:'DSP', modes:['oauth','api','export'], priority:'core', metrics:['followers','monthly listeners','streams','saves','playlist adds'], notes:'OAuth identity plus current Web API metadata and Spotify for Artists exports.' },
  { slug:'apple-music', name:'Apple Music / iTunes', category:'DSP', modes:['api','export','distributor'], priority:'core', metrics:['plays','listeners','shazams','purchases','playlist activity'], notes:'Catalog API plus Apple Music for Artists exports and DistroKid statements.' },
  { slug:'youtube', name:'YouTube / YouTube Music', category:'DSP', modes:['oauth','api','export'], priority:'core', metrics:['subscribers','views','watch time','likes','comments','shorts'], notes:'Google OAuth and YouTube Analytics for owned channels; catalog/release identity separately.' },
  { slug:'amazon-music', name:'Amazon Music', category:'DSP', modes:['export','distributor','public'], priority:'core', metrics:['streams','followers','voice requests','playlist activity'], notes:'Artist dashboard exports and distributor reporting; public profile monitoring where available.' },
  { slug:'tidal', name:'TIDAL', category:'DSP', modes:['api','export','distributor'], priority:'growth', metrics:['streams','followers','playlist adds'], notes:'Catalog API plus artist dashboard/export and DistroKid reporting.' },
  { slug:'deezer', name:'Deezer', category:'DSP', modes:['api','export','distributor'], priority:'growth', metrics:['fans','streams','playlist adds'], notes:'Public catalog API, Backstage exports, and distributor statements.' },
  { slug:'pandora', name:'Pandora', category:'Radio', modes:['export','distributor','public'], priority:'growth', metrics:['spins','listeners','stations','thumbs'], notes:'Pandora AMP exports, public station evidence, and DistroKid reporting.' },
  { slug:'soundcloud', name:'SoundCloud', category:'Discovery', modes:['oauth','api','export'], priority:'core', metrics:['followers','plays','likes','reposts','comments'], notes:'OAuth/API for owned profile and tracks, plus Insights exports.' },
  { slug:'audiomack', name:'Audiomack', category:'Discovery', modes:['export','public','distributor'], priority:'growth', metrics:['followers','plays','favorites','reposts','playlist adds'], notes:'Creator dashboard exports and public profile/playlist monitoring.' },
  { slug:'qobuz', name:'Qobuz', category:'DSP', modes:['distributor','public'], priority:'coverage', metrics:['streams','downloads','editorial features'], notes:'Distributor reports and public catalog verification.' },
  { slug:'iheartradio', name:'iHeartRadio', category:'Radio', modes:['distributor','public','manual'], priority:'growth', metrics:['spins','stations','features'], notes:'Distribution confirmation plus evidence-backed radio tracking.' },
  { slug:'tiktok', name:'TikTok / CapCut', category:'Social', modes:['oauth','export','distributor'], priority:'core', metrics:['followers','views','engagement','sound uses','creator videos'], notes:'Approved account scopes, analytics exports, and sound-delivery status.' },
  { slug:'instagram', name:'Instagram / Facebook', category:'Social', modes:['oauth','api','export','distributor'], priority:'core', metrics:['followers','reach','views','engagement','sound uses'], notes:'Meta OAuth for professional accounts plus music-delivery verification.' },
  { slug:'snapchat', name:'Snapchat', category:'Social', modes:['export','distributor','public'], priority:'coverage', metrics:['followers','views','sound uses'], notes:'Creator analytics exports and music-delivery verification.' },
  { slug:'boomplay', name:'Boomplay', category:'International', modes:['distributor','export','public'], priority:'growth', metrics:['streams','followers','playlist adds'], notes:'Distributor reporting and public/artist-dashboard verification.' },
  { slug:'anghami', name:'Anghami', category:'International', modes:['distributor','export','public'], priority:'growth', metrics:['streams','followers','playlist adds'], notes:'Distributor reporting and artist-dashboard/public verification.' },
  { slug:'jiosaavn', name:'JioSaavn', category:'International', modes:['distributor','public'], priority:'coverage', metrics:['streams','followers','playlist adds'], notes:'Distributor statements and public profile monitoring.' },
  { slug:'joox', name:'Joox', category:'International', modes:['distributor','public'], priority:'coverage', metrics:['streams','followers','playlist adds'], notes:'Distributor statements and public catalog monitoring.' },
  { slug:'netease', name:'NetEase Cloud Music', category:'International', modes:['distributor','public'], priority:'coverage', metrics:['streams','followers','playlist adds'], notes:'Distributor statements and public catalog verification.' },
  { slug:'tencent', name:'Tencent Music (QQ, Kugou, Kuwo, WeSing)', category:'International', modes:['distributor','public'], priority:'coverage', metrics:['streams','followers','playlist adds'], notes:'Grouped distribution and public release identity monitoring.' },
  { slug:'claro', name:'Claro Música', category:'International', modes:['distributor','public'], priority:'coverage', metrics:['streams','playlist adds'], notes:'Distributor statements and public catalog verification.' },
  { slug:'touch-tunes', name:'TouchTunes', category:'Radio', modes:['distributor','manual'], priority:'coverage', metrics:['jukebox plays','revenue'], notes:'DistroKid reporting and manual evidence.' },
  { slug:'bandcamp', name:'Bandcamp', category:'Direct-to-fan', modes:['public','export','manual'], priority:'growth', metrics:['followers','sales','revenue','wishlists'], notes:'Not a standard DistroKid destination; track direct-to-fan activity separately.' },
  { slug:'shazam', name:'Shazam', category:'Discovery', modes:['export','public'], priority:'growth', metrics:['shazams','cities','discovery trend'], notes:'Apple Music for Artists exports and public links.' },
  { slug:'radio-press', name:'Blogs, Radio, Podcasts & Channels', category:'Radio', modes:['public','manual'], priority:'core', metrics:['features','spins','audience estimate','contact status'], notes:'Evidence-backed coverage with source URL, date, confidence, and follow-up.' },
];

export const DISTROKID_BASELINE = MUSIC_PLATFORMS.filter((platform) => platform.modes.includes('distributor'));

export const NEVER_ALONE_RELEASE = {
  artist: 'Middle Child',
  title: 'Never Alone',
  featuredArtist: 'lowly sunday',
  releaseDate: '2026-07-31',
  upc: '882877618355',
  label: 'BVSS FVM',
  presaveUrl: 'https://distrokid.com/hyperfollow/middlechild7/never-alone-feat-low-sunday/',
};
