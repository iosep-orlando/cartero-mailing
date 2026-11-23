// Lo que viaja al navegador (DTO): ids como texto, fechas en ISO.
// Los documentos de MongoDB, con ObjectId y Date, están en lib/db.ts.

export type Role = "owner" | "member";

export interface MeDTO {
  user: { id: string; email: string; name: string };
  tenant: { id: string; name: string; role: Role } | null;
  tenants: { id: string; name: string; role: Role }[];
}

export interface ClientDTO {
  id: string;
  email: string;
  name: string;
  tags: string[];
  unsubscribed: boolean;
  bounced: boolean;
  bounceReason: string | null;
  createdAt: string;
}

export interface TemplateDTO {
  id: string;
  name: string;
  subject: string;
  html: string;
  updatedAt: string;
}

export interface AttachmentDTO {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
}

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

export interface CampaignCounts {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  opened: number; // destinatarios que abrieron al menos una vez
  clicked: number; // destinatarios que hicieron clic al menos una vez
}

export interface CampaignDTO {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  tags: string[]; // vacío = todos los clientes suscritos
  attachmentIds: string[];
  status: CampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  counts: CampaignCounts;
  createdAt: string;
}

export type DeliveryStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export interface DeliveryDTO {
  id: string;
  email: string;
  name: string;
  status: DeliveryStatus;
  error: string | null;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
}

export interface MemberDTO {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export interface InvitationDTO {
  id: string;
  email: string;
  createdAt: string;
}
