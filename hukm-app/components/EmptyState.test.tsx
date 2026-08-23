/**
 * Component smoke tests for EmptyState — the shared "nothing here yet"
 * pane used by History, Insights, and Offline surfaces.
 *
 * Verifies the accessibility contract: heading hierarchy, body copy,
 * CTA link target, and that the icon medallion stays decorative.
 */

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { EmptyState } from "./EmptyState";

describe("<EmptyState />", () => {
  it("renders title, body, and a heading-level structure", () => {
    render(
      <EmptyState
        title="No analyses yet"
        body="Run your first scenario to see results here."
        icon="history"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "No analyses yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Run your first scenario to see results here."),
    ).toBeInTheDocument();
  });

  it("renders the CTA as a link with the right destination", () => {
    render(
      <EmptyState
        title="Nothing here"
        body="Empty."
        icon="search"
        cta={{ href: "/", label: "New analysis" }}
      />,
    );
    const link = screen.getByRole("link", { name: "New analysis" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("shows secondary content when provided and omits CTA otherwise", () => {
    render(
      <EmptyState
        title="Offline"
        body="You are offline."
        icon="cloud_off"
        secondary={<a href="/offline">Retry</a>}
      />,
    );
    expect(screen.queryByRole("link", { name: /new analysis/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps the icon medallion hidden from assistive tech", () => {
    const { container } = render(
      <EmptyState title="T" body="B" icon="history" />,
    );
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});
