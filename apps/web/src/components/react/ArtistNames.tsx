import { getDisplayArtists } from '../../lib/artist-display';

interface Props {
  name: string;
  artistId?: string;
  className?: string;
}

export default function ArtistNames({ name, artistId, className }: Props) {
  const artists = getDisplayArtists(name, artistId);

  return (
    <span className={className}>
      {artists.map((artist, index) => (
        <span key={`${artist.name}-${index}`}>
          {index > 0 && ', '}
          <a href={artist.href}>{artist.name}</a>
        </span>
      ))}
    </span>
  );
}
