import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renders its label and responds to clicks", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Offer trade</Button>);

    const button = screen.getByRole("button", { name: "Offer trade" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("defaults to the primary variant", () => {
    render(<Button>Verify</Button>);
    expect(screen.getByRole("button")).toHaveStyle({ background: "#2B2620" });
  });
});
