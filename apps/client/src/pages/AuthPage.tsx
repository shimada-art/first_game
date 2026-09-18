import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Button, Card, PageShell, TextField, colors, fonts } from "@souk/ui";
import { GAME_NAME, loginSchema, signupSchema } from "@souk/shared";
import { useAuth } from "../auth/AuthContext.js";
import { ApiError } from "../api/client.js";

type Mode = "login" | "signup";

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "invalid_credentials":
        return "That email or password doesn't match our records.";
      case "already_taken":
        return "That email or username is already in use.";
      case "invalid_input":
        return "Please check the highlighted fields.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Couldn't reach the souk — check your connection and try again.";
}

export function AuthPage() {
  const { status, login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "signed-in") {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const schema = mode === "login" ? loginSchema : signupSchema;
    const parsed = schema.safeParse(mode === "login" ? { email, password } : { email, username, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in errors)) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(email, username, password);
      }
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell>
      <div
        style={{
          margin: "auto",
          width: "min(420px, 90vw)",
          padding: "24px 0",
        }}
      >
        <h1
          style={{
            fontFamily: fonts.headingLatin,
            textAlign: "center",
            fontSize: "2.2rem",
            marginBottom: "4px",
          }}
        >
          {GAME_NAME}
        </h1>
        <p style={{ textAlign: "center", color: colors.inkSoft, fontStyle: "italic", marginBottom: "28px" }}>
          The Bazaar of Lies
        </p>

        <Card>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <Button
              type="button"
              variant={mode === "login" ? "primary" : "secondary"}
              onClick={() => setMode("login")}
              style={{ flex: 1 }}
            >
              Log in
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "primary" : "secondary"}
              onClick={() => setMode("signup")}
              style={{ flex: 1 }}
            >
              Create account
            </Button>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors["email"]}
              autoComplete="email"
            />
            {mode === "signup" && (
              <TextField
                label="Merchant name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={fieldErrors["username"]}
                autoComplete="username"
              />
            )}
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors["password"]}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {formError && (
              <p role="alert" style={{ color: colors.textileText, marginBottom: "12px" }}>
                {formError}
              </p>
            )}

            <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
              {submitting ? "One moment…" : mode === "login" ? "Enter the souk" : "Join the souk"}
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}
