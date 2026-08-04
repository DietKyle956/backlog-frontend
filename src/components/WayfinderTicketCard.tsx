import type { WayfinderTicket, WayfinderTicketDependency } from "../types";

export const TICKET_TYPE_LABELS: Record<string, string> = {
  research: "Research",
  prototype: "Prototype",
  grilling: "Grilling",
  scaffold: "Scaffold",
};

/** Priority color slots mapped to ticket types:
 *  research  -> critical (red)
 *  prototype -> high (orange)
 *  grilling  -> medium (yellow)
 *  scaffold  -> low (gray)
 */
const TICKET_TYPE_PRIORITY: Record<string, number> = {
  research: 1,
  prototype: 2,
  grilling: 3,
  scaffold: 4,
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  claimed: "Claimed",
  closed: "Closed",
};

interface WayfinderTicketCardProps {
  ticket: WayfinderTicket;
  dependencyCount: number;
}

export function WayfinderTicketCard({
  ticket,
  dependencyCount,
}: WayfinderTicketCardProps) {
  const p =
    ticket.ticket_type in TICKET_TYPE_PRIORITY
      ? TICKET_TYPE_PRIORITY[ticket.ticket_type]
      : 4;
  const typeColor = `var(--color-priority-${p})`;
  const typeBg = `var(--color-priority-${p}-bg)`;
  const typeLabel = TICKET_TYPE_LABELS[ticket.ticket_type] ?? ticket.ticket_type;

  return (
    <div
      className="w-full bg-surface rounded-xl overflow-hidden
                 border border-border-subtle shadow-lg shadow-black/20
                 shrink-0"
    >
      {/* Type stripe */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: typeColor }}
      />

      <div className="p-4 space-y-2">
        {/* Header row: type badge + HITL + status */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
            style={{ color: typeColor, backgroundColor: typeBg }}
          >
            {typeLabel}
          </span>
          <div className="flex items-center gap-1.5">
            {ticket.hitl && (
              <span
                className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded-md flex items-center gap-1"
                title="Human-in-the-loop required"
                aria-label="Human-in-the-loop required"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                HITL
              </span>
            )}
            {dependencyCount > 0 && (
              <span
                className="text-xs text-text-muted"
                title={`${dependencyCount} dependencies`}
                aria-label={`${dependencyCount} dependencies`}
              >
                &#128279;{dependencyCount}
              </span>
            )}
            <span className="text-xs text-text-muted bg-surface-raised px-2 py-0.5 rounded-md">
              {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-text-primary leading-snug">
          {ticket.title}
        </h3>

        {/* Question preview */}
        {ticket.question && (
          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
            {ticket.question}
          </p>
        )}

        {/* Resolution (only for closed tickets with non-null resolution) */}
        {ticket.status === "closed" && ticket.resolution && (
          <div className="bg-surface-raised border border-border-subtle rounded-lg p-2">
            <p className="text-xs text-text-secondary leading-relaxed">
              {ticket.resolution}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
