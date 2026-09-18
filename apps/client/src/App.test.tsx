import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App.js";

describe("App", () => {
  it("redirects a signed-out visitor to the auth screen", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Souk El Kdoub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });
});
