import { handle } from "@/lib/api";
import { loadMe } from "@/lib/me";

export const GET = handle(async () => Response.json(await loadMe()));
