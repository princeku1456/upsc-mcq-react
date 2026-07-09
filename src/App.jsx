import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "./store";
import ErrorBoundary from "./components/ErrorBoundary";
import { GlobalLoader, Navbar } from "./components/Layout";
import AuthView from "./views/AuthView";
import DashboardView from "./views/dashboard/DashboardView";
import SubjectsView from "./views/testSelection/SubjectsView";
import ChaptersView from "./views/testSelection/ChaptersView";
import QuizFlow from "./views/quiz/QuizFlow";

function ProtectedRoute({ children }) {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <GlobalLoader />
      <Navbar />
      <Routes>
        <Route path="/" element={<AuthView />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><DashboardView /></ProtectedRoute>}
        />
        <Route
          path="/subjects"
          element={
            <ProtectedRoute>
              <section className="py-5" style={{ minHeight: "90vh" }}>
                <div className="container"><div id="test-content-container"><SubjectsView /></div></div>
              </section>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subjects/:subjectKey"
          element={
            <ProtectedRoute>
              <section className="py-5" style={{ minHeight: "90vh" }}>
                <div className="container"><div id="test-content-container"><ChaptersView /></div></div>
              </section>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz"
          element={<ProtectedRoute><QuizFlow /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
