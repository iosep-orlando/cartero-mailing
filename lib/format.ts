export const TIME_ZONE = "America/Argentina/Buenos_Aires";

const dateTime = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "22 nov, 21:05" en hora argentina (el servidor puede estar en UTC). */
export function formatDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

export const formatNumber = (n: number) => n.toLocaleString("es-AR");

/**
 * Para <input type="datetime-local">: la fecha en hora argentina como
 * AAAA-MM-DDTHH:MM, y al revés. Argentina no cambia de hora: siempre -03:00.
 */
export function toLocalInput(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  return new Date(`${value}:00-03:00`).toISOString();
}

/** "1 persona" / "3 personas": el número con la palabra en singular o plural. */
export function plural(n: number, one: string, many: string): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
