/*
  The date element stores its display string (mm/dd/yyyy, the form convention).
  The native date input works in ISO (yyyy-mm-dd), so these convert between the
  two. Invalid input returns "" rather than throwing.
*/

export function isoToDisplay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${month}/${day}/${year}`;
}

export function displayToIso(display: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return "";
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}
