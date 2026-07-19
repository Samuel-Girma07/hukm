/** @vitest-environment jsdom */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScenarioForm from "@/components/ScenarioForm";

describe("ScenarioForm", () => {
  it("renders the description textarea and submit button", () => {
    render(<ScenarioForm onSubmit={vi.fn()} />);

    expect(
      screen.getByLabelText(/Scenario Description/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Get Legal Analysis/i }),
    ).toBeInTheDocument();
  });

  it("disables the submit button until the description meets minimum length", () => {
    render(<ScenarioForm onSubmit={vi.fn()} />);

    const button = screen.getByRole("button", { name: /Get Legal Analysis/i });
    expect(button).toBeDisabled();

    const textarea = screen.getByLabelText(/Scenario Description/i);
    fireEvent.change(textarea, { target: { value: "Short" } });
    expect(button).toBeDisabled();

    fireEvent.change(textarea, {
      target: { value: "A long enough scenario description text." },
    });
    expect(button).not.toBeDisabled();
  });

  it("calls onSubmit with form values when submitted with a valid description", () => {
    const onSubmit = vi.fn();
    render(<ScenarioForm onSubmit={onSubmit} />);

    const textarea = screen.getByLabelText(/Scenario Description/i);
    fireEvent.change(textarea, {
      target: {
        value: "Someone broke into a shop at night and stole goods worth 5000 birr.",
      },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Get Legal Analysis/i }),
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.description).toMatch(/Someone broke into a shop/);
    expect(arg.language).toBe("english");
    expect(typeof arg.modelId).toBe("string");
    expect(arg.severity).toBe(5);
  });

  it("toggles language between English and Amharic", () => {
    const onSubmit = vi.fn();
    render(<ScenarioForm onSubmit={onSubmit} />);

    expect(screen.getByText("English")).toBeInTheDocument();

    // The toggle is the unlabeled button before the language label.
    const toggle = document.querySelector('button[type="button"]');
    expect(toggle).not.toBeNull();
    fireEvent.click(toggle!);

    expect(screen.getByText("Amharic")).toBeInTheDocument();
  });
});
