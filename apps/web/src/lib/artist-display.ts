export interface DisplayArtist {
  name: string;
  href: string;
}

export function getDisplayArtists(artistName: string, artistId?: string): DisplayArtist[] {
  const names = artistName
    .split(/\s*(?:,|&| and )\s*/i)
    .map((name) => name.trim())
    .filter(Boolean);

  return names.map((name, index) => ({
    name,
    href: index === 0 && artistId
      ? `/artist/${encodeURIComponent(artistId)}`
      : `/artist/resolve?name=${encodeURIComponent(name)}`,
  }));
}
