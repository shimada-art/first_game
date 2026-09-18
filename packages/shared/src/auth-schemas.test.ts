import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema, updateProfileSchema } from "./auth-schemas.js";

describe("signupSchema", () => {
  it("accepts a valid signup and normalizes the email", () => {
    const result = signupSchema.parse({
      email: "  Merchant@Example.com  ",
      username: "spice_trader_1",
      password: "correcthorsebattery",
    });
    expect(result.email).toBe("merchant@example.com");
  });

  it("rejects a username with invalid characters", () => {
    expect(() => signupSchema.parse({
      email: "a@b.com",
      username: "bad name!",
      password: "correcthorsebattery",
    })).toThrow();
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(() => signupSchema.parse({
      email: "a@b.com",
      username: "shortpw",
      password: "short",
    })).toThrow();
  });
});

describe("loginSchema", () => {
  it("does not enforce the password length rules (any non-empty string)", () => {
    expect(() => loginSchema.parse({ email: "a@b.com", password: "x" })).not.toThrow();
  });
});

describe("updateProfileSchema", () => {
  it("rejects an empty update", () => {
    expect(() => updateProfileSchema.parse({})).toThrow();
  });

  it("accepts a partial update", () => {
    expect(() => updateProfileSchema.parse({ displayName: "Amira" })).not.toThrow();
  });
});
