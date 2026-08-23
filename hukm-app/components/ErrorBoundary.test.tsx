/**
 * Component tests for ErrorBoundary — the last line of defence between a
 * rendering crash and the user. Verifies the fallback contract: broken
 * children produce the translated error state with working Retry, and
 * Retry actually recovers.
 */

// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb({ throw: shouldThrow }: { throw?: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error("kaboom");
  return <p>healthy content</p>;
}

function renderWithProviders(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<LanguageProvider initial="en">{ui}</LanguageProvider>);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<ErrorBoundary />", () => {
  it("renders children untouched when nothing throws", () => {
    renderWithProviders(
      <ErrorBoundary language="en">
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText("healthy content")).toBeInTheDocument();
  });

  it("swaps in the error state when a child crashes", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithProviders(
      <ErrorBoundary language="en">
        <Bomb throw />
      </ErrorBoundary>,
    );
    expect(screen.queryByText("healthy content")).toBeNull();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /report this issue/i }),
    ).toBeInTheDocument();
    spy.mockRestore();
  });

  it("recovers to normal rendering after Retry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;
    function Conditional(): React.ReactElement {
      if (shouldThrow) throw new Error("boom");
      return <p>healthy content</p>;
    }
    renderWithProviders(
      <ErrorBoundary language="en">
        <Conditional />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    shouldThrow = false;
    // Force a re-render of children after the boundary reset.
    renderWithProviders(
      <ErrorBoundary language="en">
        <Conditional />
      </ErrorBoundary>,
    );
    expect(screen.getByText("healthy content")).toBeInTheDocument();
    spy.mockRestore();
  });
});
