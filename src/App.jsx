import { useApp } from './context/AppContext.jsx';
import Loader from './components/Loader.jsx';
import Navbar from './components/Navbar.jsx';
import Breadcrumbs from './components/Breadcrumbs.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SubjectSelection from './pages/SubjectSelection.jsx';
import PracticeSelection from './pages/PracticeSelection.jsx';
import QuizPage from './pages/QuizPage.jsx';
import ReviewPage from './pages/ReviewPage.jsx';
import StartQuizModal from './components/StartQuizModal.jsx';
import RevisionTestModal from './components/RevisionTestModal.jsx';

export default function App() {
  const { view, authLoading, quizLoading, quizError, clearQuizError } = useApp();

  return (
    <>
      <Loader hidden={!authLoading} />
      <Navbar />
      <Breadcrumbs />
      {quizError && (
        <div className="container mt-3">
          <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
            <span>{quizError}</span>
            <button type="button" className="btn-close" onClick={clearQuizError} aria-label="Close"></button>
          </div>
        </div>
      )}
      {quizLoading && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.35)', zIndex: 2000 }}>
          <div className="text-center bg-white p-4 rounded-3 shadow">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-2 mb-0 text-muted">Loading Quiz...</p>
          </div>
        </div>
      )}
      {!authLoading && view === 'home' && <AuthPage />}
      {!authLoading && view === 'dashboard' && <Dashboard />}
      {!authLoading && view === 'subjects' && <SubjectSelection />}
      {!authLoading && view === 'chapters' && <SubjectSelection />}
      {!authLoading && view === 'practice' && <PracticeSelection />}
      {!authLoading && view === 'quiz' && <QuizPage />}
      {!authLoading && view === 'review' && <ReviewPage />}
      <StartQuizModal />
      <RevisionTestModal />
    </>
  );
}
