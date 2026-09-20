// apps/web/src/lib/format.ts

/** "3:42" style duration from milliseconds. */
export function formatDuration(ms: number | undefined): string {
  if (!ms || ms <= 0) return '--:--';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** "2024" from an ISO release date string. */
export function releaseYear(date: string | undefined): string {
  if (!date) return '';
  const year = new Date(date).getFullYear();
  return Number.isNaN(year) ? '' : String(year);
}

/** "2h ago" / "3d ago" style relative time, for Recently played. */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Downsizes an iTunes artwork URL for small fixed-size contexts (track
 * row thumbnails, 44x44 CSS px) — apps/api's itunes-provider.ts always
 * bakes in 600x600 (right call for AlbumCard, which renders fluid/larger),
 * so a 44px thumbnail would otherwise pull the same ~40-80KB image as a
 * full-size cover for no visual benefit. `size` should be requested at
 * roughly 2x the CSS pixel size to stay sharp on retina displays. Safe
 * no-op (returns the URL unchanged) if it doesn't match the expected
 * iTunes `/{W}x{H}bb.` pattern. */
export function thumbSrc(url: string, size = 100): string {
  if (!url) return url;
  return url.replace(/\/\d+x\d+bb\.(jpg|png)/, `/${size}x${size}bb.$1`);
}