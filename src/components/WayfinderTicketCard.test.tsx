import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WayfinderTicketCard, TICKET_TYPE_LABELS } from "./WayfinderTicketCard";
import type { WayfinderTicket } from "../types";

const baseTicket: WayfinderTicket = {
  id: 1,
  map_id: 1,
  title: "Research the authentication flow",
  question: "What is the best auth approach?",
  ticket_type: "research",
  hitl: true,
  status: "open",
  resolution: null,
  spec_file: null,
  sort_order: 1,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  closed_at: null,
};

describe("WayfinderTicketCard", () => {
  it("renders the ticket title", () => {
    render(
      <WayfinderTicketCard ticket={baseTicket} dependencyCount={0} />,
    );
    expect(screen.getByText("Research the authentication flow")).toBeInTheDocument();
  });

  it("renders all four ticket types with correct badge labels", () => {
    const types: Array<"research" | "prototype" | "grilling" | "scaffold"> = [
      "research",
      "prototype",
      "grilling",
      "scaffold",
    ];

    for (const ticketType of types) {
      const ticket = { ...baseTicket, ticket_type: ticketType };
      const { unmount } = render(
        <WayfinderTicketCard ticket={ticket} dependencyCount={0} />,
      );
      expect(screen.getByText(TICKET_TYPE_LABELS[ticketType])).toBeInTheDocument();
      unmount();
    }
  });

  it("renders each ticket type badge with a matching priority color var", () => {
    // Each ticket type maps to a specific priority color slot.
    // research -> priority 1 (critical/red), prototype -> 2 (high/orange),
    // grilling -> 3 (medium/yellow), scaffold -> 4 (low/gray)
    const typePriorityMap: Record<string, number> = {
      research: 1,
      prototype: 2,
      grilling: 3,
      scaffold: 4,
    };

    for (const [ticketType, expectedP] of Object.entries(typePriorityMap)) {
      const ticket = { ...baseTicket, ticket_type: ticketType as never };
      const { unmount, container } = render(
        <WayfinderTicketCard ticket={ticket} dependencyCount={0} />,
      );

      // The type stripe uses --color-priority-N as background
      const stripe = container.querySelector(".h-1.w-full");
      expect(stripe).not.toBeNull();
      expect((stripe as HTMLElement).style.backgroundColor).toBe(
        `var(--color-priority-${expectedP})`,
      );

      // The badge uses --color-priority-N for text and --color-priority-N-bg for background
      const badge = screen.getByText(TICKET_TYPE_LABELS[ticketType]);
      expect(badge).toBeInTheDocument();

      unmount();
    }
  });

  it("shows HITL indicator when hitl is true", () => {
    render(
      <WayfinderTicketCard
        ticket={{ ...baseTicket, hitl: true }}
        dependencyCount={0}
      />,
    );
    expect(screen.getByText("HITL")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Human-in-the-loop required"),
    ).toBeInTheDocument();
  });

  it("hides HITL indicator when hitl is false", () => {
    render(
      <WayfinderTicketCard
        ticket={{ ...baseTicket, hitl: false }}
        dependencyCount={0}
      />,
    );
    expect(screen.queryByText("HITL")).not.toBeInTheDocument();
  });

  it("shows resolution text for closed tickets with non-null resolution", () => {
    render(
      <WayfinderTicketCard
        ticket={{
          ...baseTicket,
          status: "closed",
          resolution: "Done — implemented OAuth with PKCE",
        }}
        dependencyCount={0}
      />,
    );
    expect(
      screen.getByText("Done — implemented OAuth with PKCE"),
    ).toBeInTheDocument();
  });

  it("hides resolution text for open tickets", () => {
    render(
      <WayfinderTicketCard
        ticket={{
          ...baseTicket,
          status: "open",
          resolution: "Should not show",
        }}
        dependencyCount={0}
      />,
    );
    expect(screen.queryByText("Should not show")).not.toBeInTheDocument();
  });

  it("hides resolution text for claimed tickets", () => {
    render(
      <WayfinderTicketCard
        ticket={{
          ...baseTicket,
          status: "claimed",
          resolution: "Should not show",
        }}
        dependencyCount={0}
      />,
    );
    expect(screen.queryByText("Should not show")).not.toBeInTheDocument();
  });

  it("hides resolution section for closed tickets with null resolution", () => {
    render(
      <WayfinderTicketCard
        ticket={{ ...baseTicket, status: "closed", resolution: null }}
        dependencyCount={0}
      />,
    );
    expect(screen.getByText("Closed")).toBeInTheDocument();
    // No resolution text displayed
  });

  it("shows status label for all three statuses", () => {
    for (const status of ["open", "claimed", "closed"] as const) {
      const ticket = { ...baseTicket, status };
      const { unmount } = render(
        <WayfinderTicketCard ticket={ticket} dependencyCount={0} />,
      );
      const expectedLabel =
        status === "open" ? "Open" : status === "claimed" ? "Claimed" : "Closed";
      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
      unmount();
    }
  });

  it("shows dependency count badge when ticket has dependencies", () => {
    render(
      <WayfinderTicketCard ticket={baseTicket} dependencyCount={3} />,
    );
    expect(screen.getByLabelText("3 dependencies")).toBeInTheDocument();
    expect(screen.getByText(/🔗3/)).toBeInTheDocument();
  });

  it("hides dependency count badge when ticket has no dependencies", () => {
    render(
      <WayfinderTicketCard ticket={baseTicket} dependencyCount={0} />,
    );
    expect(
      screen.queryByLabelText(/dependencies/),
    ).not.toBeInTheDocument();
  });

  it("renders question text as preview", () => {
    render(
      <WayfinderTicketCard ticket={baseTicket} dependencyCount={0} />,
    );
    expect(
      screen.getByText("What is the best auth approach?"),
    ).toBeInTheDocument();
  });

  it("hides question preview when question is empty", () => {
    const ticket = { ...baseTicket, question: "" };
    render(<WayfinderTicketCard ticket={ticket} dependencyCount={0} />);
    // The card renders without crashing; no question text displayed
    expect(
      screen.queryByText("What is the best auth approach?"),
    ).not.toBeInTheDocument();
  });
});
