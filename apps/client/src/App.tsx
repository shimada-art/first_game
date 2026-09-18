import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { PageShell } from "@souk/ui";
import { AuthProvider, useAuth } from "./auth/AuthContext.js";
import { AuthPage } from "./pages/AuthPage.js";
import { HomePage } from "./pages/HomePage.js";
import { RoomPage } from "./pages/RoomPage.js";
import { GamePage } from "./pages/GamePage.js";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <PageShell>
        <p style={{ margin: "auto" }}>Loading the souk…</p>
      </PageShell>
    );
  }
  if (status === "signed-out") {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/room/:code"
        element={
          <RequireAuth>
            <RoomPage />
          </RequireAuth>
        }
      />
      <Route
        path="/game/:code"
        element={
          <RequireAuth>
            <GamePage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
