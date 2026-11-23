import { requireUser } from "./auth";
import { collections, toObjectId } from "./db";
import type { MeDTO } from "./types";

/** Quién soy, en qué organización estoy y a cuáles más pertenezco. */
export async function loadMe(): Promise<MeDTO> {
  const session = await requireUser();
  const { users, memberships, tenants } = await collections();
  const [user, mine] = await Promise.all([
    users.findOne({ _id: session.userId }),
    memberships.find({ userId: session.userId }).sort({ createdAt: 1 }).toArray(),
  ]);
  const orgs = await tenants.find({ _id: { $in: mine.map((m) => m.tenantId) } }).toArray();
  const list = mine.flatMap((m) => {
    const org = orgs.find((o) => o._id.equals(m.tenantId));
    return org ? [{ id: org._id.toString(), name: org.name, role: m.role }] : [];
  });
  const activeId = toObjectId(session.tid)?.toString();
  return {
    user: { id: session.userId.toString(), email: session.email, name: user?.name ?? session.email },
    tenant: list.find((t) => t.id === activeId) ?? null,
    tenants: list,
  };
}
