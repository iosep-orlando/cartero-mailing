import { STATUS_LABEL } from "@/lib/campaign";
import type { CampaignStatus } from "@/lib/types";

const STYLE: Record<CampaignStatus, string> = {
  draft: "border-line bg-paper text-muted",
  scheduled: "border-amber-300 bg-amber-50 text-amber-900",
  sending: "border-correo/40 bg-correo/10 text-correo",
  sent: "border-correo bg-correo text-white",
  cancelled: "border-line bg-paper text-muted",
};

export default function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
