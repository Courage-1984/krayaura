/**
 * Site content module — swap fields when Krayaura supplies final copy/media.
 * Placeholder copy is written to fit the dual Artist / Creative Director brand.
 */
export const site = {
  name: "Krayaura",
  tagline: "Nostalgia, fun, and confidence — sound and visuals from Pretoria.",
  roles: ["Artist", "Creative Director", "Graphic Designer"],
  location: "Pretoria, South Africa",
  booking: {
    label: "Book / collab",
    // Prefer Instagram DM until a booking email is confirmed
    href: "https://www.instagram.com/krayaura/",
    note: "DM on Instagram for bookings & collabs",
  },
  bio: [
    "Krayaura is a visual communicator and recording artist building worlds where cartoon-era nostalgia meets the pulse of South African music culture.",
    "From graphic systems and motion to records and reaction energy, the work radiates joy, imagination, and a loud sense of self.",
    "Equal parts studio and stage: design that moves, music that sticks.",
  ],
  platforms: {
    spotify: "https://open.spotify.com/artist/2Avud2iTz4kMASfHFX2Pyu",
    apple: "https://music.apple.com/us/artist/krayaura/1588929160",
    youtube: "https://www.youtube.com/@Krayaura",
    behance: "https://www.behance.net/koketsoramogale1",
  },
};

export const tracks = [
  {
    id: "you-amazing",
    title: "You Amazing",
    meta: "Single · Listen now",
    tone: "gold",
    links: {
      spotify: "https://open.spotify.com/artist/2Avud2iTz4kMASfHFX2Pyu",
      apple: "https://music.apple.com/us/artist/krayaura/1588929160",
    },
  },
  {
    id: "crash",
    title: "Crash",
    meta: "Single · Featured",
    tone: "red",
    links: {
      spotify: "https://open.spotify.com/artist/2Avud2iTz4kMASfHFX2Pyu",
      youtube: "https://www.youtube.com/@Krayaura",
    },
  },
  {
    id: "andale",
    title: "Andale",
    meta: "feat. Dioscuri & KxMxJ",
    tone: "blue",
    links: {
      spotify: "https://open.spotify.com/artist/2Avud2iTz4kMASfHFX2Pyu",
      apple: "https://music.apple.com/us/artist/krayaura/1588929160",
    },
  },
  {
    id: "smoothies",
    title: "Let's Get Smoothies",
    meta: "Vibe track",
    tone: "gold",
    links: {
      spotify: "https://open.spotify.com/artist/2Avud2iTz4kMASfHFX2Pyu",
      youtube: "https://www.youtube.com/@Krayaura",
    },
  },
];

export const featuredVideo = {
  title: "Watch on YouTube",
  // Swap embedUrl to a specific video: https://www.youtube.com/embed/VIDEO_ID
  embedUrl: null,
  fallbackHref: "https://www.youtube.com/@Krayaura",
};

export const projects = [
  {
    id: "brand-worlds",
    title: "Brand Worlds",
    tag: "Identity",
    description:
      "Loud, nostalgic identity systems built for artists and culture brands who want to feel iconic on first glance.",
    href: "https://www.behance.net/koketsoramogale1",
    cover: null,
  },
  {
    id: "cover-art",
    title: "Cover Art",
    tag: "Music visuals",
    description:
      "Single and EP packaging that treats every release like a cartoon frame you can hold.",
    href: "https://www.behance.net/koketsoramogale1",
    cover: null,
  },
  {
    id: "motion-drops",
    title: "Motion Drops",
    tag: "Videography",
    description:
      "Short-form motion and reaction energy for TikTok, Reels, and rollout campaigns.",
    href: "https://www.instagram.com/krayaura/",
    cover: null,
  },
  {
    id: "campaign-looks",
    title: "Campaign Looks",
    tag: "Art direction",
    description:
      "Visual direction spanning photography, type, and colour — confidence first, clutter never.",
    href: "https://www.behance.net/koketsoramogale1",
    cover: null,
  },
];

export const socials = [
  { label: "Instagram", href: "https://www.instagram.com/krayaura/" },
  { label: "TikTok", href: "https://www.tiktok.com/@krayaura" },
  { label: "YouTube", href: "https://www.youtube.com/@Krayaura" },
  { label: "Spotify", href: "https://open.spotify.com/artist/2Avud2iTz4kMASfHFX2Pyu" },
  { label: "Apple Music", href: "https://music.apple.com/us/artist/krayaura/1588929160" },
  { label: "Behance", href: "https://www.behance.net/koketsoramogale1" },
  { label: "Linktree", href: "https://linktr.ee/krayaura" },
];
