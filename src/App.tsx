import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { CreateTrip } from "@/pages/CreateTrip";
import { TripHome } from "@/pages/TripHome";
import { TripSettings } from "@/pages/TripSettings";
import { TripBalances } from "@/pages/TripBalances";
import { TripReports } from "@/pages/TripReports";
import { GuestJoin } from "@/pages/GuestJoin";
import { TripLayout } from "@/components/trip/TripLayout";
import { AddExpense } from "@/pages/AddExpense";

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
                <TripLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<TripHome />} />
            <Route path="balances" element={<TripBalances />} />
            <Route path="reports" element={<TripReports />} />
          </Route>
          <Route
            path="/trips/:tripId/settings"
            element={
              <ProtectedRoute>
                <TripSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/:tripId/expenses/new"
            element={
              <ProtectedRoute>
                <AddExpense />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
