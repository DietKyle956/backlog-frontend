import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StoryCard } from "../../../../src/components/StoryCard";
import type { Story } from "../../../../src/types";

/**
 * E2E-aligned tests for the cleanDescription markdown-stripping helper.
 *
 * Before this fix, stories with long markdown descriptions (e.g. BLF-027
 * through BLF-031) showed raw markdown in the `line-clamp-2` preview <p>,
 * which caused formatting artifacts and uneven vertical spacing between
 * story cards. The fix strips all markdown formatting and collapses
 * whitespace to produce clean, predictable plain text for the card preview.
 */

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 1,
    project_id: 3,
    key: "BLF-027",
    title: "Test story with markdown description",
    description: "",
    status: "backlog",
    acceptance_criteria: [],
    priority: 2,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    reviewed_by: null,
    ...overrides,
  };
}

describe("cleanDescription (StoryCard description preview)", () => {
  it("strips ATX heading lines entirely (including heading text)", () => {
    // Heading text is structural and doesn't flow as inline body text.
    // The function strips the entire heading line, which is correct for a
    // line-clamped card preview where standalone section labels are noise.
    const story = makeStory({
      description:
        "## Overview\nThis card handles OAuth login flow.\n### Details\nThe implementation uses Supabase Auth.",
    });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const preview = container.querySelector("p.line-clamp-2");
    expect(preview).not.toBeNull();
    const text = preview!.textContent ?? "";
    // Body text is preserved as plain text
    expect(text).toContain("This card handles OAuth login flow.");
    expect(text).toContain("The implementation uses Supabase Auth.");
    // No markdown formatting leaks through
    expect(text).not.toContain("##");
    expect(text).not.toContain("###");
  });

  it("strips bold and italic markdown", () => {
    const story = makeStory({
      description:
        "This is **very important** and this is *emphasized* and this is _also emphasized_.",
    });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const preview = container.querySelector("p.line-clamp-2");
    const text = preview!.textContent ?? "";
    expect(text).toContain("very important");
    expect(text).toContain("emphasized");
    expect(text).toContain("also emphasized");
    expect(text).not.toContain("**");
    expect(text).not.toContain("*");
    expect(text).not.toContain("_");
  });

  it("strips list markers", () => {
    const story = makeStory({
      description: "- First item\n- Second item\n* Star item",
    });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const preview = container.querySelector("p.line-clamp-2");
    const text = preview!.textContent ?? "";
    expect(text).toContain("First item");
    expect(text).toContain("Second item");
    expect(text).toContain("Star item");
    // No raw `-` or `*` list markers at line start should remain as prefix
    expect(text).not.match(/^- /);
    expect(text).not.match(/^\* /);
  });

  it("strips inline code backticks", () => {
    const story = makeStory({
      description: "Use the `useMemo` hook before calling `fetchData`.",
    });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const preview = container.querySelector("p.line-clamp-2");
    const text = preview!.textContent ?? "";
    expect(text).toContain("useMemo");
    expect(text).toContain("fetchData");
    expect(text).not.toContain("`");
  });

  it("collapses multiple newlines and whitespace into single spaces", () => {
    const story = makeStory({
      description: "Line one.\n\n\nLine three.\n\nLine five.",
    });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const preview = container.querySelector("p.line-clamp-2");
    const text = preview!.textContent ?? "";
    // Should be a single-line, space-separated blob
    expect(text).not.toContain("\n");
    expect(text).not.toMatch(/ {2,}/); // no double+ spaces
    expect(text).toMatch(/Line one. Line three. Line five./);
  });

  it("completely strips a complex multi-format markdown description", () => {
    // Simulates a BLF-027-style description with headings, bold, lists, code, and trailing whitespace
    const story = makeStory({
      description: `## Summary
Implement the **bulk update** feature for the Kanban board.

### Acceptance Criteria
- Select multiple cards at once
- Apply status change in one action
- Show *undo* toast on success

### Technical Notes
Use \`useReducer\` for the selection state. The backend endpoint is \`POST /api/stories/bulk\`.
`,
    });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const preview = container.querySelector("p.line-clamp-2");
    const text = preview!.textContent ?? "";

    // Body-level content should be present as plain text (heading lines
    // are stripped entirely - they are structural, not sentence-flow text).
    expect(text).toContain("Implement the");
    expect(text).toContain("bulk update");
    expect(text).toContain("Kanban board");
    expect(text).toContain("Select multiple cards at once");
    expect(text).toContain("Apply status change in one action");
    expect(text).toContain("undo");
    expect(text).toContain("useReducer");
    expect(text).toContain("POST /api/stories/bulk");

    // No markdown formatting should leak through
    expect(text).not.toContain("##");
    expect(text).not.toContain("**");
    expect(text).not.toContain("`");
    expect(text).not.toContain("###");
    expect(text).not.toContain("- ");
    expect(text).not.toContain("* ");
    expect(text).not.toContain("_");

    // No newlines should remain
    expect(text).not.toContain("\n");
  });

  it("produces consistent-length output for cards with different markdown formats", () => {
    // Two descriptions that render differently in markdown should produce
    // comparable-sized plain-text blobs, ensuring consistent line-clamp-2.
    // The plain version omits heading prefixes and markdown characters but
    // keeps all body text - the cleaned markdown should match it exactly.
    const markdownStory = makeStory({
      id: 1,
      key: "BLF-027",
      description: `This is a story about **authentication** and *session management*.
- Login flow
- Token refresh
- Session expiry`,
    });

    const plainStory = makeStory({
      id: 2,
      key: "BLF-028",
      description: "This is a story about authentication and session management. Login flow Token refresh Session expiry",
    });

    const { container: mdContainer } = render(
      <StoryCard story={markdownStory} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const { container: plainContainer } = render(
      <StoryCard story={plainStory} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );

    const mdText = mdContainer.querySelector("p.line-clamp-2")!.textContent ?? "";
    const plainText = plainContainer.querySelector("p.line-clamp-2")!.textContent ?? "";

    // The cleaned markdown should look very similar to the hand-stripped plain version.
    // Normalize both by collapsing whitespace for a fair comparison.
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    expect(normalize(mdText)).toBe(normalize(plainText));
  });

  it("handles empty description gracefully (no preview rendered)", () => {
    const story = makeStory({ description: "" });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    // No description preview paragraph should be rendered
    expect(container.querySelector("p.line-clamp-2")).toBeNull();
  });

  it("handles description with only markdown formatting and no real text", () => {
    const story = makeStory({
      description: "##\n\n**\n\n- \n\n* ",
    });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const preview = container.querySelector("p.line-clamp-2");
    if (preview) {
      // Even garbage input should not produce heading or bold markdown in output
      const text = preview.textContent ?? "";
      expect(text).not.toContain("##");
      expect(text).not.toContain("**");
    }
  });

  it("preserves intentional spaces between words when stripping markdown", () => {
    const story = makeStory({
      description: "The **quick brown** fox *jumps over* the `lazy` dog.",
    });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const preview = container.querySelector("p.line-clamp-2");
    const text = preview!.textContent ?? "";
    expect(text).toMatch(/The quick brown fox jumps over the lazy dog\./);
  });

  it("does NOT strip underscore emphasis mid-word (word boundary assertion)", () => {
    // This tests the fix from the review commit 4de5be2:
    // underscore emphasis regex uses \b word boundaries to avoid
    // stripping underscores inside identifiers like `use_memo`.
    const story = makeStory({
      description:
        "The function _use_memo_ is used for caching. This is _really_ important.",
    });
    const { container } = render(
      <StoryCard story={story} blockers={[]} dependencyCount={0} onClick={() => {}} />,
    );
    const preview = container.querySelector("p.line-clamp-2");
    const text = preview!.textContent ?? "";
    // `use_memo` should keep its underscores (inside identifier)
    expect(text).toContain("use_memo");
    // `really` should have its underscores stripped (italic emphasis)
    expect(text).not.toContain("_really_");
    expect(text).toContain("really");
  });
});
