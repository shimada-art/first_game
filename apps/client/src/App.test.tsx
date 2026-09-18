import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App.js";

describe("App", () => {
  it("renders the game title and a create-room action", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Souk El Kdoub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create room" })).toBeInTheDocument();
  });
});
