import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WayfinderMapView } from "./WayfinderMapView";
import type { WayfinderMap, WayfinderTicket, WayfinderTicketDependency } from "../types";

const baseMap: WayfinderMap = {
  id: 1,
  project_id: 1,
  title: "Auth System Design",
  destination: "A robust, secure OAuth-based authentication system",
  notes: "Consider PKCE for mobile. Research OIDC compatibility.",
  decisions_so_far:
    "OAuth 2.0 with PKCE. Supabase Auth as the initial provider.",
  not_yet_specified: "Multi-factor auth requirements. Session management strategy.",
  out_of_scope: "Social login beyond GitHub. Password-less auth for v1.",
  status: "active",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-02T00:00:00Z",
};

const baseTicket: WayfinderTicket = {
  id: 1,
  map_id: 1,
  title: "Research OAuth flows",
  question: "Which OAuth flow is best for a mobile-first SPA?",
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

const baseDependencies: WayfinderTicketDependency[] = [];

describe("WayfinderMapView", () => {
  it("renders the map title and status", () => {
    render(
      <WayfinderMapView
        map={baseMap}
        tickets={[]}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("Auth System Design")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("lists tickets sorted by sort_order", () => {
    const tickets: WayfinderTicket[] = [
      { ...baseTicket, id: 1, title: "Third ticket", sort_order: 3 },
      { ...baseTicket, id: 2, title: "First ticket", sort_order: 1 },
      { ...baseTicket, id: 3, title: "Second ticket", sort_order: 2 },
    ];

    render(
      <WayfinderMapView
        map={baseMap}
        tickets={tickets}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );

    const titles = screen
      .getAllByText(/ticket$/)
      .map((el) => el.textContent);

    // The tickets should appear in sort_order: 1, 2, 3
    expect(titles).toEqual(["First ticket", "Second ticket", "Third ticket"]);
  });

  it("displays destination when present", () => {
    render(
      <WayfinderMapView
        map={baseMap}
        tickets={[]}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );
    expect(
      screen.getByText(
        "A robust, secure OAuth-based authentication system",
      ),
    ).toBeInTheDocument();
  });

  it("displays collapsible metadata sections", () => {
    render(
      <WayfinderMapView
        map={baseMap}
        tickets={[]}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );

    // Section headers are visible
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Decisions So Far")).toBeInTheDocument();
    expect(screen.getByText("Not Yet Specified")).toBeInTheDocument();
    expect(screen.getByText("Out of Scope")).toBeInTheDocument();
  });

  it("expands a metadata section on click to show its content", () => {
    render(
      <WayfinderMapView
        map={baseMap}
        tickets={[]}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );

    // Notes content should be hidden initially
    expect(
      screen.queryByText("Consider PKCE for mobile. Research OIDC compatibility."),
    ).not.toBeInTheDocument();

    // Click to expand Notes
    fireEvent.click(screen.getByText("Notes"));

    // Content should now be visible
    expect(
      screen.getByText("Consider PKCE for mobile. Research OIDC compatibility."),
    ).toBeInTheDocument();
  });

  it("collapses an expanded section on second click", () => {
    render(
      <WayfinderMapView
        map={baseMap}
        tickets={[]}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );

    // Expand
    fireEvent.click(screen.getByText("Notes"));
    expect(
      screen.getByText("Consider PKCE for mobile. Research OIDC compatibility."),
    ).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText("Notes"));
    expect(
      screen.queryByText("Consider PKCE for mobile. Research OIDC compatibility."),
    ).not.toBeInTheDocument();
  });

  it("shows empty state for a map with no tickets", () => {
    render(
      <WayfinderMapView
        map={baseMap}
        tickets={[]}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("No tickets in this map yet")).toBeInTheDocument();
  });

  it("shows correct ticket count", () => {
    const tickets = [
      { ...baseTicket, id: 1 },
      { ...baseTicket, id: 2 },
      { ...baseTicket, id: 3 },
    ];

    render(
      <WayfinderMapView
        map={baseMap}
        tickets={tickets}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("3 tickets")).toBeInTheDocument();
  });

  it("uses singular 'ticket' label for single ticket", () => {
    render(
      <WayfinderMapView
        map={baseMap}
        tickets={[{ ...baseTicket }]}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("1 ticket")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", () => {
    let backPressed = false;
    render(
      <WayfinderMapView
        map={baseMap}
        tickets={[]}
        dependencies={baseDependencies}
        onBack={() => {
          backPressed = true;
        }}
      />,
    );

    fireEvent.click(screen.getByLabelText("Back to board"));
    expect(backPressed).toBe(true);
  });

  it("hides metadata sections that have empty content", () => {
    const mapWithoutMetadata = {
      ...baseMap,
      notes: "",
      decisions_so_far: "",
      not_yet_specified: "",
      out_of_scope: "",
    };

    render(
      <WayfinderMapView
        map={mapWithoutMetadata}
        tickets={[]}
        dependencies={baseDependencies}
        onBack={() => {}}
      />,
    );

    // No collapsible sections should render
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Decisions So Far")).not.toBeInTheDocument();
    expect(screen.queryByText("Not Yet Specified")).not.toBeInTheDocument();
    expect(screen.queryByText("Out of Scope")).not.toBeInTheDocument();
  });

  it("shows dependency counts on tickets", () => {
    const tickets = [
      { ...baseTicket, id: 1, title: "Ticket with 2 deps" },
    ];
    const deps: WayfinderTicketDependency[] = [
      { ticket_id: 1, depends_on_id: 2 },
      { ticket_id: 1, depends_on_id: 3 },
    ];

    render(
      <WayfinderMapView
        map={baseMap}
        tickets={tickets}
        dependencies={deps}
        onBack={() => {}}
      />,
    );

    expect(screen.getByLabelText("2 dependencies")).toBeInTheDocument();
  });
});
