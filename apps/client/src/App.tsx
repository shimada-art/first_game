import { GAME_NAME } from "@souk/shared";
import { Button, colors, fonts } from "@souk/ui";

export function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        background: colors.paper,
        color: colors.ink,
        fontFamily: fonts.bodyLatin,
      }}
    >
      <h1 style={{ fontFamily: fonts.headingLatin }}>{GAME_NAME}</h1>
      <p>Foundations scaffold — the real bazaar is still to come.</p>
      <Button>Create room</Button>
    </main>
  );
}
