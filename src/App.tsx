import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
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
import { NavigationRestoration } from "@/components/NavigationRestoration";
import { SettlementDetail } from "@/pages/SettlementDetail";
import { EditSettlement } from "@/pages/EditSettlement";

const AddExpense = lazy(() =>
  import("@/pages/AddExpense").then((module) => ({ default: module.AddExpense })),
);
const ExpenseDetail = lazy(() =>
  import("@/pages/ExpenseDetail").then((module) => ({ default: module.ExpenseDetail })),
);

export default function App() {
  return (
    <BrowserRouter>
      <NavigationRestoration />
      <AuthProvider>
        <ThemeProvider>
        <Suspense
          fallback={
            <div className="min-h-dvh bg-bg px-6 pt-10">
              <div className="skeleton mx-auto h-[280px] max-w-[382px] rounded-[22px]" />
            </div>
          }
        >
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
            <Route path="expenses/new" element={<AddExpense />} />
            <Route path="expenses/:entryId" element={<ExpenseDetail />} />
            <Route path="expenses/:entryId/edit" element={<AddExpense />} />
            <Route path="settlements/:settlementId" element={<SettlementDetail />} />
            <Route path="settlements/:settlementId/edit" element={<EditSettlement />} />
          </Route>
          <Route
            path="/trips/:tripId/settings"
            element={
              <ProtectedRoute>
                <TripSettings />
              </ProtectedRoute>
            }
          />
        </Routes>
        </Suspense>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
