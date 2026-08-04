import { useState, useMemo } from "react";
import type { WayfinderMap, WayfinderTicket, WayfinderTicketDependency } from "../types";
import { WayfinderTicketCard } from "./WayfinderTicketCard";

interface WayfinderMapViewProps {
  map: WayfinderMap;
  tickets: WayfinderTicket[];
  dependencies: WayfinderTicketDependency[];
  onBack: () => void;
}

type MetadataSection = "notes" | "decisions" | "notYetSpecified" | "outOfScope";

const SECTION_LABELS: Record<MetadataSection, string> = {
  notes: "Notes",
  decisions: "Decisions So Far",
  notYetSpecified: "Not Yet Specified",
  outOfScope: "Out of Scope",
};

type WayfinderMapMetadataKey = "notes" | "decisions_so_far" | "not_yet_specified" | "out_of_scope";

const SECTION_KEYS: Record<MetadataSection, WayfinderMapMetadataKey> = {
  notes: "notes",
  decisions: "decisions_so_far",
  notYetSpecified: "not_yet_specified",
  outOfScope: "out_of_scope",
};

const MAP_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

function CollapsibleSection({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2
                   bg-surface-raised hover:bg-surface-hover
                   transition-colors text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`text-text-muted transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-border-subtle">
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

export function WayfinderMapView({
  map,
  tickets,
  dependencies,
  onBack,
}: WayfinderMapViewProps) {
  const sortedTickets = useMemo(
    () => [...tickets].sort((a, b) => a.sort_order - b.sort_order),
    [tickets],
  );

  const getDependencyCount = (ticketId: number): number => {
    return dependencies.filter((d) => d.ticket_id === ticketId).length;
  };

  const sections: MetadataSection[] = [
    "notes",
    "decisions",
    "notYetSpecified",
    "outOfScope",
  ];

  return (
    <div className="fixed inset-0 z-50 bg-canvas animate-slide-in-right overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-subtle">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="text-text-secondary hover:text-text-primary transition-colors p-1 -ml-1"
            aria-label="Back to board"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-text-primary">{map.title}</h1>
          <span className="text-xs text-text-muted bg-surface-raised px-2 py-0.5 rounded-md">
            {MAP_STATUS_LABELS[map.status] ?? map.status}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Map metadata */}
        <div className="space-y-3">
          {/* Destination */}
          {map.destination && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">
                Destination
              </h3>
              <p className="text-sm text-text-secondary">{map.destination}</p>
            </div>
          )}

          {/* Collapsible metadata sections */}
          {sections.map((section) => {
            const content = map[SECTION_KEYS[section]];
            if (!content) return null;
            return (
              <CollapsibleSection
                key={section}
                title={SECTION_LABELS[section]}
                content={content}
              />
            );
          })}
        </div>

        {/* Ticket count */}
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Tickets
          </h2>
          <span className="text-sm text-text-muted">
            {sortedTickets.length} {sortedTickets.length === 1 ? "ticket" : "tickets"}
          </span>
        </div>

        {/* Ticket list */}
        {sortedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-text-muted/70">
              No tickets in this map yet
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {sortedTickets.map((ticket) => (
              <WayfinderTicketCard
                key={ticket.id}
                ticket={ticket}
                dependencyCount={getDependencyCount(ticket.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
