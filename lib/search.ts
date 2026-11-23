/** Texto del usuario → patrón literal para $regex: "a.b(" no rompe ni comodín. */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
