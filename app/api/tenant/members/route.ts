import { requireTenant } from "@/lib/auth";
import { handle } from "@/lib/api";
import { collections } from "@/lib/db";
import type { InvitationDTO, MemberDTO } from "@/lib/types";

/** Miembros e invitaciones pendientes de la organización activa. */
export const GET = handle(async () => {
  const caller = await requireTenant();
  const { memberships, users, invitations } = await collections();
  const list = await memberships.find({ tenantId: caller.tenantId }).sort({ createdAt: 1 }).toArray();
  const people = await users.find({ _id: { $in: list.map((m) => m.userId) } }).toArray();
  const members: MemberDTO[] = list.flatMap((m) => {
    const person = people.find((p) => p._id.equals(m.userId));
    return person ? [{ userId: person._id.toString(), email: person.email, name: person.name, role: m.role }] : [];
  });
  const pending: InvitationDTO[] = (
    await invitations.find({ tenantId: caller.tenantId }).sort({ createdAt: -1 }).toArray()
  ).map((i) => ({ id: i._id.toString(), email: i.email, createdAt: i.createdAt.toISOString() }));
  return Response.json({ members, invitations: pending });
});
