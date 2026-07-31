import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StoryCard } from "./StoryCard";
import { SkeletonCard } from "./SkeletonCard";
import type { Story } from "../types";

const sampleStory: Story = {
  id: 1,
  project_id: 1,
  key: "TEST-001",
  title: "Test story title",
  description: "A test story with some description text",
  status: "backlog",
  acceptance_criteria: ["Done when working"],
  priority: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  reviewed_by: null,
};

describe("Card collapse fix: shrink-0 prevents flex collapse in scrollable containers", () => {
  it("StoryCard has shrink-0 class", () => {
    const { container } = render(
      <StoryCard
        story={sampleStory}
        blockers={[]}
        dependencyCount={0}
        onClick={() => {}}
      />,
    );

    const card = container.firstElementChild!;
    expect(card.classList.contains("shrink-0")).toBe(true);
  });

  it("SkeletonCard has shrink-0 class", () => {
    const { container } = render(<SkeletonCard />);

    const card = container.firstElementChild!;
    expect(card.classList.contains("shrink-0")).toBe(true);
  });

  it("StoryCard maintains intrinsic height when rendered in a flex-col container", () => {
    // Simulate the Board's scrollable container: flex flex-col gap-3 overflow-y-auto
    const { container } = render(
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-3"
        style={{ width: "375px" }}
      >
        <StoryCard
          story={sampleStory}
          blockers={[]}
          dependencyCount={0}
          onClick={() => {}}
        />
      </div>,
    );

    const card = container.querySelector(".shrink-0")!;
    expect(card).not.toBeNull();

    // The card should have a computed height > 0 (not collapsed)
    // JSDOM may not compute layout, but we can verify the class chain is correct
    const cardEl = card as HTMLElement;

    // Verify the card has the complete class chain needed to prevent collapse:
    // w-full (stretch to container width) + shrink-0 (prevent flex shrink)
    expect(cardEl.classList.contains("w-full")).toBe(true);
    expect(cardEl.classList.contains("shrink-0")).toBe(true);

    // The card has overflow-hidden which, per CSS spec, sets min-height to 0
    // on flex items. shrink-0 counters this by setting flex-shrink: 0.
    expect(cardEl.classList.contains("overflow-hidden")).toBe(true);
  });

  it("SkeletonCard maintains intrinsic height in flex-col loading container", () => {
    // Simulate App.tsx loading state: flex flex-col gap-3
    const { container } = render(
      <div
        className="flex-1 px-4 flex flex-col gap-3"
        style={{ width: "375px" }}
      >
        <SkeletonCard />
        <SkeletonCard />
      </div>,
    );

    const cards = container.querySelectorAll(".shrink-0");
    expect(cards).toHaveLength(2);

    cards.forEach((card) => {
      expect(card.classList.contains("w-full")).toBe(true);
      expect(card.classList.contains("overflow-hidden")).toBe(true);
    });
  });

  it("both card types have consistent class structure for flex safety", () => {
    const { container: storyContainer } = render(
      <StoryCard
        story={sampleStory}
        blockers={[]}
        dependencyCount={0}
        onClick={() => {}}
      />,
    );
    const { container: skeletonContainer } = render(<SkeletonCard />);

    const storyCard = storyContainer.firstElementChild!;
    const skeletonCard = skeletonContainer.firstElementChild!;

    // Both cards share the foundational classes that interact with flex:
    const sharedClasses = ["w-full", "shrink-0", "overflow-hidden"];

    sharedClasses.forEach((cls) => {
      expect(storyCard.classList.contains(cls)).toBe(true);
      expect(skeletonCard.classList.contains(cls)).toBe(true);
    });
  });

  it("StoryCard still renders all its content correctly with shrink-0", () => {
    const blockers = [
      {
        id: 1,
        story_id: 1,
        blocking_story_id: 2,
        description: "Blocked by TEST-002",
        resolved_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const { getByText, getByLabelText } = render(
      <StoryCard
        story={sampleStory}
        blockers={blockers}
        dependencyCount={2}
        onClick={() => {}}
      />,
    );

    // Content still renders: key badge
    expect(getByText("TEST-001")).toBeTruthy();
    // Title
    expect(getByText("Test story title")).toBeTruthy();
    // Description
    expect(getByText("A test story with some description text")).toBeTruthy();
    // Blocked indicator
    expect(getByLabelText("Blocked")).toBeTruthy();
    // Dependency count
    expect(getByLabelText("2 dependencies")).toBeTruthy();
  });
});
