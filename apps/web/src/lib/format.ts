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
