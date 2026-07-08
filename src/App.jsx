/* =========================================
   ROOT APP — React Router replacing view switch.
   Renders navbar, global loader, and route-based views.
   ========================================= */
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "./store";
import { GlobalLoader, Navbar } from "./components/Layout";
import AuthView from "./views/AuthView";
import DashboardView from "./views/DashboardView";
import { SubjectsView, ChaptersView } from "./views/TestSelection";
import QuizFlow from "./views/QuizFlow";
import PracticeConfigView from "./views/PracticeConfigView";

/* ---------- Auth guard: redirect to / if not logged in ---------- */
function ProtectedRoute({ children }) {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <GlobalLoader />
      <Navbar />
      <Routes>
        <Route path="/" element={<AuthView />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/performance"
          element={
            <ProtectedRoute>
              <DashboardView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects"
          element={
            <ProtectedRoute>
              <section className="py-5" style={{ minHeight: "90vh" }}>
                <div className="container">
                  <div id="test-content-container">
                    <SubjectsView />
                  </div>
                </div>
              </section>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects/:subjectKey"
          element={
            <ProtectedRoute>
              <section className="py-5" style={{ minHeight: "90vh" }}>
                <div className="container">
                  <div id="test-content-container">
                    <ChaptersView />
                  </div>
                </div>
              </section>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <QuizFlow />
            </ProtectedRoute>
          }
        />
        <Route
          path="/practice/config"
          element={
            <ProtectedRoute>
              <PracticeConfigView />
            </ProtectedRoute>
          }
        />
        {/* Catch-all: redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
