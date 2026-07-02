import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { CreateTrip } from "@/pages/CreateTrip";
import { TripHome } from "@/pages/TripHome";
import { TripBalances } from "@/pages/TripBalances";
import { TripReports } from "@/pages/TripReports";
import { GuestJoin } from "@/pages/GuestJoin";
import { ComingSoon } from "@/pages/ComingSoon";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/join/:token" element={<GuestJoin />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/new"
            element={
              <ProtectedRoute>
                <CreateTrip />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/:tripId"
            element={
              <ProtectedRoute>
                <TripHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/:tripId/balances"
            element={
              <ProtectedRoute>
                <TripBalances />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/:tripId/reports"
            element={
              <ProtectedRoute>
                <TripReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/:tripId/expenses/new"
            element={
              <ProtectedRoute>
                <ComingSoon title="Add expense" />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
