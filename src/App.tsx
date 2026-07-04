import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TripLayout } from "@/components/trip/TripLayout";
import { NavigationRestoration } from "@/components/NavigationRestoration";

const Login = lazy(() => import("@/pages/Login").then(({ Login }) => ({ default: Login })));
const Dashboard = lazy(() => import("@/pages/Dashboard").then(({ Dashboard }) => ({ default: Dashboard })));
const CreateTrip = lazy(() => import("@/pages/CreateTrip").then(({ CreateTrip }) => ({ default: CreateTrip })));
const TripHome = lazy(() => import("@/pages/TripHome").then(({ TripHome }) => ({ default: TripHome })));
const TripSettings = lazy(() => import("@/pages/TripSettings").then(({ TripSettings }) => ({ default: TripSettings })));
const TripBalances = lazy(() => import("@/pages/TripBalances").then(({ TripBalances }) => ({ default: TripBalances })));
const TripReports = lazy(() => import("@/pages/TripReports").then(({ TripReports }) => ({ default: TripReports })));
const GuestJoin = lazy(() => import("@/pages/GuestJoin").then(({ GuestJoin }) => ({ default: GuestJoin })));
const SettlementDetail = lazy(() =>
  import("@/pages/SettlementDetail").then(({ SettlementDetail }) => ({ default: SettlementDetail })),
);
const EditSettlement = lazy(() =>
  import("@/pages/EditSettlement").then(({ EditSettlement }) => ({ default: EditSettlement })),
);
const PrivacyPolicy = lazy(() =>
  import("@/pages/Legal").then(({ PrivacyPolicy }) => ({ default: PrivacyPolicy })),
);
const TermsConditions = lazy(() =>
  import("@/pages/Legal").then(({ TermsConditions }) => ({ default: TermsConditions })),
);
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
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/terms" element={<TermsConditions />} />
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
