import React, { useCallback, useEffect, useRef, useState } from "react";
import { auth, db } from "../lib/firebase";
import { DataManager } from "../lib/dataManager";
import { firebaseService } from "../services/firebaseService";
import { quizService } from "../services/quizService";
import { toastr } from "../lib/toastr";
import AdminLogin from "./AdminLogin";
import AdminTestAnalysis from "./AdminTestAnalysis";
import AdminUserManagement from "./AdminUserManagement";
import AdminQuestionCard from "./AdminQuestionCard";
import AdminUserReviewModal from "./AdminUserReviewModal";
import { Leaderboard, Palette, EmptyState } from "./AdminAnalysisDisplay";

export default function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const adminAnalysisCache = useRef({});
  const allQuizData = useRef(null);

  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("");
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState("");
  const [userEmails, setUserEmails] = useState([]);

  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const [searchEmail, setSearchEmail] = useState("");
  const [attempts, setAttempts] = useState(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [displayEmail, setDisplayEmail] = useState("");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const isAdmin = await firebaseService.checkAdminAccess(user.uid);
        if (isAdmin) {
          setAuthed(true);
          setChecking(false);
          await loadSubjects();
          loadAllUserEmails();
        } else {
          auth.signOut();
          setAuthed(false);
          setChecking(false);
        }
      } else {
        setAuthed(false);
        setChecking(false);
      }
    });
    return unsub;
  }, []);

  const loadAllUserEmails = useCallback(async () => {
    const emails = await firebaseService.fetchAllUserEmails();
    setUserEmails(emails);
  }, []);

  const loadSubjects = useCallback(async () => {
    if (!allQuizData.current) allQuizData.current = await DataManager.fetchQuizManifest();
    if (!allQuizData.current) { setSubjects([]); return; }
    setSubjects(Object.keys(allQuizData.current).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })));
  }, []);

  const onSubjectChange = (sub) => {
    setSubject(sub);
    setChapterId("");
    if (!sub || !allQuizData.current[sub]) { setChapters([]); return; }
    const sortedChapters = Object.keys(allQuizData.current[sub]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    setChapters(sortedChapters.map((chapId) => ({
      value: sub.replace(/\s+/g, "_") + "_" + chapId,
      label: chapId,
    })));
  };

  const logoutAdmin = () => auth.signOut();

  const loadTestAnalysis = async () => {
    if (!chapterId) return toastr.warning("Select Subject and Test.");
    delete adminAnalysisCache.current[chapterId];
    setAnalysisError(null);
    setAnalysis(null);
    setAnalysisLoading(true);

    try {
      const [quizData, statsData, results] = await Promise.all([
        DataManager.fetchQuizQuestions(chapterId),
        firebaseService.fetchGlobalStats(chapterId),
        firebaseService.fetchResultsByChapter(chapterId),
      ]);

      if (!quizData) throw new Error("Quiz content not found.");
      const accuracies = quizService.calculateAccuracies(quizData, results);

      setAnalysis({ questions: quizData, results, stats: statsData || { totalAttempts: 0, average: 0 }, accuracies });
      setAnalysisLoading(false);
      toastr.success("Discussion data updated!");
    } catch (error) {
      console.error("Analysis Fetch Error:", error);
      setAnalysisError(error.message);
      setAnalysisLoading(false);
    }
  };

  const searchUserAttempts = async () => {
    const email = searchEmail.trim().toLowerCase();
    if (!email) return toastr.warning("Please enter a user email.");
    setAttemptsLoading(true);
    setAttempts([]);
    setDisplayEmail(email);

    try {
      const rows = await firebaseService.fetchResultsByUser(email);
      setAttempts(rows);
      setAttemptsLoading(false);
    } catch (error) {
      console.error("Search Error:", error);
      toastr.error("Error fetching user data. Ensure index is created in Firebase if required.");
      setAttempts(null);
      setAttemptsLoading(false);
    }
  };

  const deleteAttempt = async (docId, testName, data) => {
    if (!window.confirm(`CRITICAL: This will delete the attempt for "${testName}" and RECALCULATE all global class statistics. Proceed?`)) return;
    try {
      await firebaseService.deleteAttempt(docId, data.chapterId, data);
      toastr.success("Attempt deleted and global stats updated!");
      searchUserAttempts();
      adminAnalysisCache.current = {};
    } catch (error) {
      console.error("Delete Transaction Error:", error);
      toastr.error("Failed to complete full deletion.");
    }
  };

  const viewUserAttempt = async (docId, chapId, chapterName) => {
    setModal({ title: `Review: ${chapterName}`, loading: true, data: null, error: null });
    try {
      const { resultData, questions } = await firebaseService.fetchResultWithQuestions(docId, chapId);
      const userAnswers = resultData.userAnswers || {};
      const subjectStats = quizService.computeSubjectBreakdown(questions, userAnswers);

      let correctCount = 0, incorrectCount = 0, unattemptedCount = 0;
      questions.forEach((q, index) => {
        const correctIndex = q.options.indexOf(q.correctAnswer) >= 0 ? q.options.indexOf(q.correctAnswer) : q.correctAnswer;
        const uAns = userAnswers[index];
        if (!uAns) unattemptedCount++;
        else if (uAns.answer === correctIndex) correctCount++;
        else incorrectCount++;
      });

      setModal({
        title: `Review: ${chapterName}`,
        loading: false, error: null,
        data: { resultData, userAnswers, questions, correctCount, incorrectCount, unattemptedCount, subjectStats },
      });
    } catch (error) {
      console.error("Error loading user attempt details:", error);
      setModal({ title: "Attempt Review", loading: false, data: null, error: error.message });
    }
  };

  if (checking) {
    return <div className="text-center py-5"><div className="spinner-border text-primary" role="status"></div></div>;
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-dark shadow-sm sticky-top" style={{ backgroundColor: "#1e3a8a" }}>
        <div className="container">
          <span className="navbar-brand fw-bold mb-0 h1"><i className="bi bi-shield-lock-fill me-2"></i>MCQ Admin Panel</span>
          {authed && <button className="btn btn-outline-light btn-sm rounded-pill px-3" onClick={logoutAdmin}>Logout</button>}
        </div>
      </nav>

      {!authed ? (
        <AdminLogin />
      ) : (
        <section className="container py-5">
          <AdminUserManagement
            userEmails={userEmails} searchEmail={searchEmail} attempts={attempts}
            attemptsLoading={attemptsLoading} displayEmail={displayEmail}
            onSearchEmailChange={setSearchEmail} onSearch={searchUserAttempts}
            onViewAttempt={viewUserAttempt} onDeleteAttempt={deleteAttempt}
          />

          <AdminTestAnalysis
            subjects={subjects} subject={subject} chapters={chapters} chapterId={chapterId}
            onSubjectChange={onSubjectChange} onChapterChange={setChapterId} onAnalyze={loadTestAnalysis}
          />

          {analysisLoading ? (
            <div className="text-center py-5"><div className="spinner-border text-primary"></div><p>Fetching latest discussion data...</p></div>
          ) : analysisError ? (
            <><div className="alert alert-danger">{analysisError}</div><EmptyState /></>
          ) : analysis ? (
            <div className="row">
              <div className="col-lg-9">
                <Leaderboard leaderboardArr={analysis.stats.leaderboard || []} stats={analysis.stats} />
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-4 mt-2">
                    <h4 className="fw-bold text-dark border-start border-4 border-primary ps-3">📊 Discussion Dashboard</h4>
                  </div>
                  {analysis.questions.map((q, qIdx) => (
                    <AdminQuestionCard
                      key={qIdx}
                      question={q}
                      qIdx={qIdx}
                      results={analysis.results}
                      accuracy={analysis.accuracies[qIdx]}
                      resultsWithUserNames={analysis.results.map((res) => ({
                        original: res,
                        userName: res.userEmail ? res.userEmail.split("@")[0] : "Guest",
                      }))}
                    />
                  ))}
                </div>
              </div>
              <div className="col-lg-3">
                <div className="admin-palette-sidebar">
                  <h6 className="fw-bold mb-3"><i className="bi bi-grid-3x3-gap me-2"></i>Heat Map Palette</h6>
                  <Palette accuracies={analysis.accuracies} />
                  <div className="mt-4 pt-3 border-top">
                    <small className="text-muted d-block mb-2">LEGEND:</small>
                    <div className="d-flex align-items-center mb-1"><span className="badge heat-low me-2" style={{ width: "15px", height: "15px", padding: 0 }}></span><small>High Error (&lt;40%)</small></div>
                    <div className="d-flex align-items-center mb-1"><span className="badge heat-mid me-2" style={{ width: "15px", height: "15px", padding: 0 }}></span><small>Average (40-70%)</small></div>
                    <div className="d-flex align-items-center"><span className="badge heat-high me-2" style={{ width: "15px", height: "15px", padding: 0 }}></span><small>Good (&gt;70%)</small></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      )}

      {modal && <AdminUserReviewModal modal={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
