import { z } from "zod";

// bcrypt silently ignores bytes past 72 — cap here so a truncated password
// never surprises a user into "my password doesn't work anymore."
const PASSWORD_MAX_BYTES = 72;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(PASSWORD_MAX_BYTES, `Password must be at most ${PASSWORD_MAX_BYTES} characters`);

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name can't be empty")
  .max(40, "Display name must be at most 40 characters");

export const bioSchema = z.string().trim().max(280, "Bio must be at most 280 characters");

export const signupSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    avatarKey: z.string().trim().min(1).max(100).nullable().optional(),
    bio: bioSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
