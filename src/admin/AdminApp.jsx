/* =========================================
   ADMIN APP (ported from admin.js + admin.html)
   Login (admins-collection gate), subject/chapter selects,
   loadTestAnalysis, heat-map palette, question analysis with
   per-option user+surety buckets, leaderboard, user search,
   viewUserAttempt modal with filters, deleteAttempt transaction.
   Every Firestore query, transaction and calculation is unchanged.
   ========================================= */
import React, { useCallback, useEffect, useRef, useState } from "react";
import firebase, { auth, db } from "../lib/firebase";
import { DataManager } from "../lib/dataManager";
import { getCorrectIndex, TextFormatter } from "../lib/helpers";
import { toastr } from "../lib/toastr";

export default function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  // REDUCED READS: memory cache for admin analysis (verbatim intent)
  const adminAnalysisCache = useRef({});
  const allQuizData = useRef(null);

  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState("");
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState("");

  const [userEmails, setUserEmails] = useState([]);

  const [analysis, setAnalysis] = useState(null); // {questions, results, stats, accuracies}
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  const [searchEmail, setSearchEmail] = useState("");
  const [attempts, setAttempts] = useState(null); // null=idle | []=loaded
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [displayEmail, setDisplayEmail] = useState("");

  const [modal, setModal] = useState(null); // { title, loading, data, error }

  /* --- Auth & admin gate (verbatim) --- */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        db.collection("admins")
          .doc(user.uid)
          .get()
          .then(async (doc) => {
            if (doc.exists) {
              setAuthed(true);
              setChecking(false);
              await loadSubjects();
              loadAllUserEmails();
            } else {
              auth.signOut();
              setAuthed(false);
              setChecking(false);
            }
          });
      } else {
        setAuthed(false);
        setChecking(false);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- loadAllUserEmails (verbatim query) --- */
  const loadAllUserEmails = useCallback(async () => {
    try {
      const snapshot = await db.collection("results").get();
      const emails = new Set();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userEmail && data.userEmail !== "guest") {
          emails.add(data.userEmail.toLowerCase());
        }
      });
      setUserEmails(Array.from(emails).sort());
    } catch (error) {
      console.error("Error loading user emails:", error);
    }
  }, []);

  /* --- loadSubjects (verbatim sort) --- */
  const loadSubjects = useCallback(async () => {
    if (!allQuizData.current) {
      allQuizData.current = await DataManager.fetchQuizManifest();
    }
    if (!allQuizData.current) {
      setSubjects([]);
      return;
    }
    const sorted = Object.keys(allQuizData.current).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    setSubjects(sorted);
  }, []);

  /* --- loadChapters (verbatim) --- */
  const onSubjectChange = (sub) => {
    setSubject(sub);
    setChapterId("");
    if (!sub || !allQuizData.current[sub]) {
      setChapters([]);
      return;
    }
    const sortedChapters = Object.keys(allQuizData.current[sub]).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    setChapters(
      sortedChapters.map((chapId) => ({
        value: sub.replace(/\s+/g, "_") + "_" + chapId,
        label: chapId,
      }))
    );
  };

  /* --- login (verbatim) --- */
  const handleLogin = (e) => {
    e.preventDefault();
    const email = e.target.elements["admin-email"].value;
    const password = e.target.elements["admin-password"].value;
    auth
      .signInWithEmailAndPassword(email, password)
      .catch((err) => toastr.error(err.message));
  };

  const logoutAdmin = () => auth.signOut();

  /* --- calculateAccuracies (verbatim) --- */
  const calculateAccuracies = (questions, results) => {
    return questions.map((q, qIdx) => {
      const correctIndex = getCorrectIndex(q);
      let correctCount = 0;
      results.forEach((res) => {
        const choice = res.userAnswers ? res.userAnswers[qIdx] : null;
        if (choice && choice.answer === correctIndex) correctCount++;
      });
      return results.length > 0
        ? Math.round((correctCount / results.length) * 100)
        : 0;
    });
  };

  /* --- loadTestAnalysis (verbatim fetch) --- */
  const loadTestAnalysis = async () => {
    const dbChapterId = chapterId;
    if (!dbChapterId) return toastr.warning("Select Subject and Test.");

    delete adminAnalysisCache.current[dbChapterId];
    setAnalysisError(null);
    setAnalysis(null);
    setAnalysisLoading(true);

    try {
      const [quizData, statsDoc, resultsSnap] = await Promise.all([
        DataManager.fetchQuizQuestions(dbChapterId),
        db.collection("chapter_stats").doc(dbChapterId).get(),
        db
          .collection("results")
          .where("chapterId", "==", dbChapterId)
          .orderBy("timestamp", "desc")
          .limit(100)
          .get(),
      ]);

      if (!quizData) throw new Error("Quiz content not found.");

      const quizQuestions = quizData;
      const statsData = statsDoc.exists
        ? statsDoc.data()
        : { totalAttempts: 0, average: 0 };
      const results = resultsSnap.docs.map((doc) => doc.data());

      adminAnalysisCache.current[dbChapterId] = {
        questions: quizQuestions,
        stats: statsData,
        results: results,
      };

      const questionAccuracies = calculateAccuracies(quizQuestions, results);

      setAnalysis({
        questions: quizQuestions,
        results,
        stats: statsData,
        accuracies: questionAccuracies,
      });
      setAnalysisLoading(false);
      toastr.success("Discussion data updated!");
    } catch (error) {
      console.error("Analysis Fetch Error:", error);
      setAnalysisError(error.message);
      setAnalysisLoading(false);
    }
  };

  /* --- searchUserAttempts (verbatim) --- */
  const searchUserAttempts = async () => {
    const email = searchEmail.trim().toLowerCase();
    if (!email) return toastr.warning("Please enter a user email.");

    setAttemptsLoading(true);
    setAttempts([]);
    setDisplayEmail(email);

    try {
      const snapshot = await db
        .collection("results")
        .where("userEmail", "==", email)
        .orderBy("timestamp", "desc")
        .get();

      if (snapshot.empty) {
        setAttempts([]);
        setAttemptsLoading(false);
        return;
      }

      const rows = snapshot.docs.map((doc) => {
        const data = doc.data();
        const date = data.timestamp
          ? new Date(data.timestamp.toDate()).toLocaleDateString()
          : "N/A";
        return { id: doc.id, ...data, date };
      });
      setAttempts(rows);
      setAttemptsLoading(false);
    } catch (error) {
      console.error("Search Error:", error);
      toastr.error(
        "Error fetching user data. Ensure index is created in Firebase if required."
      );
      setAttempts(null);
      setAttemptsLoading(false);
    }
  };

  /* --- deleteAttempt (verbatim transaction) --- */
  const deleteAttempt = async (docId, testName) => {
    if (
      !window.confirm(
        `CRITICAL: This will delete the attempt for "${testName}" and RECALCULATE all global class statistics. Proceed?`
      )
    ) {
      return;
    }

    try {
      const resultRef = db.collection("results").doc(docId);
      const resultSnap = await resultRef.get();

      if (!resultSnap.exists) {
        toastr.error("Result record not found.");
        return;
      }

      const data = resultSnap.data();
      const chapterIdLocal = data.chapterId;
      const scorePercent = data.scorePercent;
      const userAnswers = data.userAnswers || {};
      const statsRef = db.collection("chapter_stats").doc(chapterIdLocal);

      await db.runTransaction(async (transaction) => {
        const statsSnap = await transaction.get(statsRef);
        transaction.delete(resultRef);

        if (statsSnap.exists) {
          const stats = statsSnap.data();
          const newAttempts = Math.max(0, (stats.totalAttempts || 1) - 1);
          const newTotalScore = Math.max(0, (stats.totalScore || 0) - scorePercent);
          const newAverage = newAttempts > 0 ? newTotalScore / newAttempts : 0;

          let newAllScores = [...(stats.allScores || [])];
          const scoreIndex = newAllScores.indexOf(scorePercent);
          if (scoreIndex > -1) newAllScores.splice(scoreIndex, 1);

          const newHighest = newAllScores.length > 0 ? Math.max(...newAllScores) : 0;

          let newLeaderboard = (stats.leaderboard || []).filter((entry) => {
            if (entry.resultId && entry.resultId === docId) {
              return false;
            }
            if (entry.userEmail === data.userEmail) {
              const scoreMatch = Math.abs(entry.scorePercent - scorePercent) < 0.1;
              const entryTime = new Date(entry.rankTime).getTime();
              const dataTime = data.timestamp ? data.timestamp.toDate().getTime() : 0;
              const timeDiff = Math.abs(entryTime - dataTime);
              const timeMatch = timeDiff < 5000;
              if (scoreMatch && timeMatch) {
                return false;
              }
            }
            return true;
          });

          let cCounts = [...(stats.correctCounts || [])];
          let aCounts = [...(stats.attemptedCounts || [])];

          Object.entries(userAnswers).forEach(([idx, ans]) => {
            const i = parseInt(idx);
            if (aCounts[i] > 0) aCounts[i]--;
            if (ans.isCorrect && cCounts[i] > 0) cCounts[i]--;
          });

          transaction.update(statsRef, {
            totalAttempts: newAttempts,
            totalScore: newTotalScore,
            average: newAverage,
            allScores: newAllScores,
            highestScore: newHighest,
            leaderboard: newLeaderboard,
            correctCounts: cCounts,
            attemptedCounts: aCounts,
          });
        }
      });

      toastr.success("Attempt deleted and global stats updated!");
      searchUserAttempts();
      adminAnalysisCache.current = {};
    } catch (error) {
      console.error("Delete Transaction Error:", error);
      toastr.error("Failed to complete full deletion.");
    }
  };

  /* --- viewUserAttempt (verbatim compute) --- */
  const viewUserAttempt = async (docId, chapId, chapterName) => {
    setModal({ title: `Review: ${chapterName}`, loading: true, data: null, error: null });

    try {
      const [resultSnap, questions] = await Promise.all([
        db.collection("results").doc(docId).get(),
        DataManager.fetchQuizQuestions(chapId),
      ]);

      if (!resultSnap.exists) throw new Error("Result record not found.");
      if (!questions) throw new Error("Quiz questions not found.");

      const resultData = resultSnap.data();
      const userAnswers = resultData.userAnswers || {};

      let correctCount = 0;
      let incorrectCount = 0;
      let unattemptedCount = 0;
      const subjectStats = {};

      questions.forEach((q, index) => {
        const correctIndex = getCorrectIndex(q);
        const uAns = userAnswers[index];
        const attempted = uAns !== undefined;
        const isCorrect = attempted && uAns.answer === correctIndex;

        if (!attempted) unattemptedCount++;
        else if (isCorrect) correctCount++;
        else incorrectCount++;

        if (q.subject) {
          const subj = q.subject.trim();
          if (!subjectStats[subj]) {
            subjectStats[subj] = { total: 0, correct: 0, incorrect: 0, unattempted: 0 };
          }
          subjectStats[subj].total++;
          if (!attempted) subjectStats[subj].unattempted++;
          else if (isCorrect) subjectStats[subj].correct++;
          else subjectStats[subj].incorrect++;
        }
      });

      setModal({
        title: `Review: ${chapterName}`,
        loading: false,
        error: null,
        data: {
          resultData,
          userAnswers,
          questions,
          correctCount,
          incorrectCount,
          unattemptedCount,
          subjectStats,
        },
      });
    } catch (error) {
      console.error("Error loading user attempt details:", error);
      setModal({
        title: "Attempt Review",
        loading: false,
        data: null,
        error: error.message,
      });
    }
  };

  /* =========================================
     RENDER
     ========================================= */
  if (checking) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav
        className="navbar navbar-dark shadow-sm sticky-top"
        style={{ backgroundColor: "#1e3a8a" }}
      >
        <div className="container">
          <span className="navbar-brand fw-bold mb-0 h1">
            <i className="bi bi-shield-lock-fill me-2"></i>MCQ Admin Panel
          </span>
          {authed && (
            <button
              className="btn btn-outline-light btn-sm rounded-pill px-3"
              onClick={logoutAdmin}
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      {!authed ? (
        <section className="container mt-5">
          <div className="row justify-content-center">
            <div className="col-md-5">
              <div className="card shadow border-0 rounded-4 p-4">
                <h3 className="text-center fw-bold text-primary mb-2">Admin Login</h3>
                <form onSubmit={handleLogin}>
                  <div className="mb-3">
                    <label className="form-label fw-bold small text-muted">Email</label>
                    <input
                      type="email"
                      name="admin-email"
                      className="form-control bg-light"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="form-label fw-bold small text-muted">Password</label>
                    <input
                      type="password"
                      name="admin-password"
                      className="form-control bg-light"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary-custom w-100 py-3 rounded-3">
                    Access Dashboard
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="container py-5">
          {/* Manage User Attempts */}
          <div className="card shadow-sm border-0 rounded-4 p-4 mb-5">
            <h5 className="fw-bold text-primary mb-4">
              <i className="bi bi-people-fill me-2"></i>Manage User Attempts
            </h5>
            <div className="row g-3">
              <div className="col-md-10">
                <select
                  className="form-select form-select-lg"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                >
                  <option value="" disabled>
                    Select a User Email...
                  </option>
                  {userEmails.map((email) => (
                    <option key={email} value={email}>
                      {email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <button
                  className="btn btn-secondary-custom w-100 py-2 btn-lg"
                  onClick={searchUserAttempts}
                >
                  Search 🔍
                </button>
              </div>
            </div>

            {(attemptsLoading || attempts !== null) && (
              <div className="mt-4">
                <hr />
                <h6 className="fw-bold mb-3">
                  Attempts for: <span className="text-secondary">{displayEmail}</span>
                </h6>
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Test Name</th>
                        <th>Score</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attemptsLoading ? (
                        <tr>
                          <td colSpan="5" className="text-center py-4">
                            <div className="spinner-border spinner-border-sm text-primary"></div>{" "}
                            Fetching user records...
                          </td>
                        </tr>
                      ) : attempts && attempts.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center text-muted py-4">
                            No attempts found for this user.
                          </td>
                        </tr>
                      ) : (
                        (attempts || []).map((data) => (
                          <tr key={data.id}>
                            <td>
                              <small className="text-muted">{data.date}</small>
                            </td>
                            <td>
                              <span className="fw-bold">{data.subject}</span>
                            </td>
                            <td>{data.chapterName}</td>
                            <td>
                              <span className="badge bg-primary">{data.scorePercent}%</span>
                            </td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-primary btn-sm me-1"
                                onClick={() =>
                                  viewUserAttempt(data.id, data.chapterId, data.chapterName)
                                }
                              >
                                <i className="bi bi-eye"></i> View
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => deleteAttempt(data.id, data.chapterName)}
                              >
                                <i className="bi bi-trash"></i> Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Select Test to Analyze */}
          <div className="card shadow-sm border-0 rounded-4 p-4 mb-5">
            <h5 className="fw-bold text-primary mb-4">
              <i className="bi bi-search me-2"></i>Select Test to Analyze
            </h5>
            <div className="row g-3">
              <div className="col-md-5">
                <select
                  className="form-select form-select-lg"
                  value={subject}
                  onChange={(e) => onSubjectChange(e.target.value)}
                >
                  <option value="">-- Choose Subject --</option>
                  {subjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-5">
                <select
                  className="form-select form-select-lg"
                  value={chapterId}
                  disabled={!subject}
                  onChange={(e) => setChapterId(e.target.value)}
                >
                  <option value="">-- Choose Test --</option>
                  {chapters.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <button
                  className="btn btn-primary-custom w-100 py-2 btn-lg"
                  onClick={loadTestAnalysis}
                >
                  Analyze 🚀
                </button>
              </div>
            </div>
          </div>

          {/* Analysis layout */}
          {analysisLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary"></div>
              <p>Fetching latest discussion data...</p>
            </div>
          ) : analysisError ? (
            <>
              <div className="alert alert-danger">{analysisError}</div>
              <EmptyState />
            </>
          ) : analysis ? (
            <div className="row">
              <div className="col-lg-9">
                <Leaderboard
                  leaderboardArr={analysis.stats.leaderboard || []}
                  stats={analysis.stats}
                />
                <QuestionAnalysis
                  questions={analysis.questions}
                  results={analysis.results}
                  accuracies={analysis.accuracies}
                />
              </div>
              <div className="col-lg-3">
                <div className="admin-palette-sidebar">
                  <h6 className="fw-bold mb-3">
                    <i className="bi bi-grid-3x3-gap me-2"></i>Heat Map Palette
                  </h6>
                  <Palette accuracies={analysis.accuracies} />
                  <div className="mt-4 pt-3 border-top">
                    <small className="text-muted d-block mb-2">LEGEND:</small>
                    <div className="d-flex align-items-center mb-1">
                      <span
                        className="badge heat-low me-2"
                        style={{ width: "15px", height: "15px", padding: 0 }}
                      ></span>
                      <small>High Error (&lt;40%)</small>
                    </div>
                    <div className="d-flex align-items-center mb-1">
                      <span
                        className="badge heat-mid me-2"
                        style={{ width: "15px", height: "15px", padding: 0 }}
                      ></span>
                      <small>Average (40-70%)</small>
                    </div>
                    <div className="d-flex align-items-center">
                      <span
                        className="badge heat-high me-2"
                        style={{ width: "15px", height: "15px", padding: 0 }}
                      ></span>
                      <small>Good (&gt;70%)</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      )}

      {modal && <UserReviewModal modal={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center text-muted py-5">
      <div className="display-1 opacity-25 mb-3">
        <i className="bi bi-bar-chart-steps"></i>
      </div>
      <h4>Select a test to begin the Discussion Session.</h4>
    </div>
  );
}

/* ---- Heat-map palette (renderPalette port) ---- */
function Palette({ accuracies }) {
  return (
    <div id="admin-palette-grid" className="palette-grid">
      {accuracies.map((acc, i) => {
        let heatClass = "heat-high";
        if (acc < 40) heatClass = "heat-low";
        else if (acc <= 70) heatClass = "heat-mid";
        return (
          <div
            key={i}
            className={`palette-item ${heatClass}`}
            title={`Accuracy: ${acc}%`}
            role="button"
            tabIndex={0}
            aria-label={`Question ${i + 1}: ${acc}% Accuracy`}
            onClick={() => {
              const el = document.getElementById(`q-card-${i}`);
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const el = document.getElementById(`q-card-${i}`);
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }
            }}
          >
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}

/* ---- Leaderboard (renderOptimizedLeaderboard port) ---- */
function Leaderboard({ leaderboardArr, stats }) {
  return (
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-5">
      <div className="card-header bg-white border-bottom p-4">
        <h5 className="fw-bold text-primary m-0">🏆 Leaderboard</h5>
        <small className="text-muted">
          Total Attempts: {stats.totalAttempts} | Global Avg:{" "}
          {stats.average ? stats.average.toFixed(1) : 0}%
        </small>
      </div>
      <div className="table-responsive">
        <table className="table table-hover mb-0">
          <thead className="table-light">
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Score</th>
              <th>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {leaderboardArr.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center">
                  No records.
                </td>
              </tr>
            ) : (
              leaderboardArr.map((entry, i) => (
                <tr key={i}>
                  <td className="fw-bold">#{i + 1}</td>
                  <td>{entry.userEmail.split("@")[0]}</td>
                  <td>{entry.score.toFixed(1)}</td>
                  <td>
                    <span
                      className={`badge ${
                        entry.scorePercent >= 80 ? "bg-success" : "bg-secondary"
                      }`}
                    >
                      {entry.scorePercent}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---- Question analysis (renderQuestionAnalysis port) ---- */
function QuestionAnalysis({ questions, results, accuracies }) {
  const resultsWithUserNames = results.map((res) => ({
    original: res,
    userName: res.userEmail ? res.userEmail.split("@")[0] : "Guest",
  }));

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 mt-2">
        <h4 className="fw-bold text-dark border-start border-4 border-primary ps-3">
          📊 Discussion Dashboard
        </h4>
      </div>
      {questions.map((q, qIdx) => {
        const optionBuckets = q.options.map(() => []);
        const skippedUsers = [];
        const correctIndex = getCorrectIndex(q);

        resultsWithUserNames.forEach((item) => {
          const res = item.original;
          const userName = item.userName;
          const choice = res.userAnswers ? res.userAnswers[qIdx] : null;
          const suretyVal =
            choice && choice.surety !== undefined ? choice.surety + "%" : "N/A";
          if (!choice || choice.answer === undefined || choice.answer === -1) {
            skippedUsers.push({ name: userName, surety: suretyVal });
          } else if (optionBuckets[choice.answer]) {
            optionBuckets[choice.answer].push({ name: userName, surety: suretyVal });
          }
        });

        const accuracy = accuracies[qIdx];

        return (
          <div
            key={qIdx}
            id={`q-card-${qIdx}`}
            className={`card mb-5 shadow-sm border-0 rounded-4 admin-q-card ${
              accuracy < 40 ? "high-error" : ""
            }`}
          >
            <div className="card-body p-4">
              <div className="d-flex justify-content-between mb-3">
                <span className="badge bg-primary bg-opacity-10 text-primary">
                  Question {qIdx + 1}
                </span>
                <span className="badge bg-light text-dark border">Accuracy: {accuracy}%</span>
              </div>
              <div
                className="fw-bold mb-4 h5"
                dangerouslySetInnerHTML={{
                  __html: TextFormatter.formatQuestionText(q.text),
                }}
              ></div>
              <div className="row g-4">
                <div className="col-12">
                  {q.options.map((opt, oIdx) => {
                    const isCorrect = oIdx === correctIndex;
                    const users = optionBuckets[oIdx];
                    const percent =
                      results.length > 0
                        ? Math.round((users.length / results.length) * 100)
                        : 0;
                    return (
                      <div
                        key={oIdx}
                        className={`p-3 border rounded-3 mb-2 ${
                          isCorrect ? "bg-success bg-opacity-10 border-success" : "bg-white"
                        }`}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <span
                              className={`badge ${
                                isCorrect ? "bg-success" : "bg-secondary"
                              } me-2`}
                            >
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className={isCorrect ? "fw-bold text-success" : ""}>{opt}</span>
                          </div>
                          <span className="fw-bold text-muted small">
                            {users.length} Users ({percent}%)
                          </span>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mt-2 user-list-container">
                          {users.map((u, ui) => (
                            <span
                              key={ui}
                              className="badge user-tag d-flex align-items-center gap-1"
                            >
                              {u.name}{" "}
                              <strong
                                className="text-primary"
                                style={{
                                  fontSize: "0.65rem",
                                  borderLeft: "1px solid #ddd",
                                  paddingLeft: "4px",
                                }}
                              >
                                {u.surety}
                              </strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-3 p-2 bg-light rounded-3 border-dashed border-2">
                    <small className="text-muted fw-bold">
                      ⚪ SKIPPED ({skippedUsers.length})
                    </small>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {skippedUsers.length === 0
                        ? "None"
                        : skippedUsers.map((u, ui) => (
                            <span
                              key={ui}
                              className="badge user-tag border-secondary text-secondary"
                            >
                              {u.name} <small className="ms-1 opacity-50">({u.surety})</small>
                            </span>
                          ))}
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <div className="explanation-box mb-3">
                    <h6 className="fw-bold text-warning-emphasis">
                      <i className="bi bi-lightbulb"></i> Explanation:
                    </h6>
                    <p className="small m-0">{q.explanation || "No explanation."}</p>
                  </div>
                  <div className="p-3 bg-primary bg-opacity-10 rounded-3">
                    <small className="fw-bold text-primary d-block mb-1">DISCUSSION TIP</small>
                    <p className="small m-0 text-primary-emphasis">
                      {accuracy < 40
                        ? "⚠️ High error rate with mixed confidence."
                        : "✅ Concept generally understood."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- User review modal (viewUserAttempt + filterAdminQuestions port) ---- */
function UserReviewModal({ modal, onClose }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjFilter, setSubjFilter] = useState("all");

  const d = modal.data;

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header bg-light">
            <h5 className="modal-title fw-bold text-primary">{modal.title}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4 bg-light">
            {modal.loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary"></div>
                <p>Fetching test details...</p>
              </div>
            ) : modal.error ? (
              <div className="alert alert-danger">Error loading details: {modal.error}</div>
            ) : d ? (
              <ModalBody
                data={d}
                statusFilter={statusFilter}
                subjFilter={subjFilter}
                setStatusFilter={setStatusFilter}
                setSubjFilter={setSubjFilter}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalBody({ data, statusFilter, subjFilter, setStatusFilter, setSubjFilter }) {
  const {
    resultData,
    userAnswers,
    questions,
    correctCount,
    incorrectCount,
    unattemptedCount,
    subjectStats,
  } = data;

  const subjectKeys = Object.keys(subjectStats).sort();

  return (
    <>
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white border-0 shadow-sm h-100">
            <div className="card-body text-center p-3">
              <h6 className="opacity-75 mb-1">Score</h6>
              <h3 className="fw-bold mb-0">{resultData.scorePercent}%</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-success text-white border-0 shadow-sm h-100">
            <div className="card-body text-center p-3">
              <h6 className="opacity-75 mb-1">Correct</h6>
              <h3 className="fw-bold mb-0">{correctCount}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-danger text-white border-0 shadow-sm h-100">
            <div className="card-body text-center p-3">
              <h6 className="opacity-75 mb-1">Incorrect</h6>
              <h3 className="fw-bold mb-0">{incorrectCount}</h3>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-secondary text-white border-0 shadow-sm h-100">
            <div className="card-body text-center p-3">
              <h6 className="opacity-75 mb-1">Unattempted</h6>
              <h3 className="fw-bold mb-0">{unattemptedCount}</h3>
            </div>
          </div>
        </div>
      </div>

      {subjectKeys.length > 0 && (
        <div className="card mb-4 border-0 shadow-sm">
          <div className="card-header bg-white fw-bold">
            <i className="bi bi-bar-chart-fill me-2 text-primary"></i>Subject-wise Performance
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 text-center align-middle">
              <thead className="table-light">
                <tr>
                  <th className="text-start">Subject</th>
                  <th>Total</th>
                  <th className="text-success">Correct</th>
                  <th className="text-danger">Incorrect</th>
                  <th className="text-secondary">Unattempted</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {subjectKeys.map((subj) => {
                  const s = subjectStats[subj];
                  const attempted = s.correct + s.incorrect;
                  const acc = attempted > 0 ? Math.round((s.correct / attempted) * 100) : 0;
                  return (
                    <tr key={subj}>
                      <td className="text-start fw-bold">{subj}</td>
                      <td>{s.total}</td>
                      <td className="text-success">{s.correct}</td>
                      <td className="text-danger">{s.incorrect}</td>
                      <td className="text-secondary">{s.unattempted}</td>
                      <td>
                        <span
                          className={`badge ${
                            acc >= 70
                              ? "bg-success"
                              : acc >= 40
                              ? "bg-warning text-dark"
                              : "bg-danger"
                          }`}
                        >
                          {acc}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold m-0">Detailed Analysis</h5>
        <div className="btn-group btn-group-sm" role="group">
          {["all", "correct", "incorrect", "unattempted"].map((st) => {
            const color =
              st === "all"
                ? "primary"
                : st === "correct"
                ? "success"
                : st === "incorrect"
                ? "danger"
                : "secondary";
            return (
              <React.Fragment key={st}>
                <input
                  type="radio"
                  className="btn-check"
                  name="adminQFilter"
                  id={`btnradio-${st}`}
                  autoComplete="off"
                  checked={statusFilter === st}
                  onChange={() => setStatusFilter(st)}
                />
                <label className={`btn btn-outline-${color}`} htmlFor={`btnradio-${st}`}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </label>
              </React.Fragment>
            );
          })}
        </div>
        <select
          className="form-select form-select-sm w-auto ms-2"
          value={subjFilter}
          onChange={(e) => setSubjFilter(e.target.value)}
        >
          <option value="all">All Subjects</option>
          {subjectKeys.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2" id="admin-questions-list">
        {questions.map((q, index) => {
          const correctIndex = getCorrectIndex(q);
          const uAns = userAnswers[index];
          const attempted = uAns !== undefined;
          const isCorrect = attempted && uAns.answer === correctIndex;

          let statusBadge, borderClass, statusClass;
          if (!attempted) {
            statusBadge = <span className="badge bg-secondary mb-2">Unattempted</span>;
            borderClass = "border-secondary";
            statusClass = "unattempted";
          } else if (isCorrect) {
            statusBadge = <span className="badge bg-success mb-2">Correct</span>;
            borderClass = "border-success";
            statusClass = "correct";
          } else {
            statusBadge = <span className="badge bg-danger mb-2">Incorrect</span>;
            borderClass = "border-danger";
            statusClass = "incorrect";
          }

          const qSubj = q.subject ? q.subject.trim() : null;
          const statusMatch = statusFilter === "all" || statusFilter === statusClass;
          const subjMatch = subjFilter === "all" || subjFilter === qSubj;
          const hidden = !(statusMatch && subjMatch);

          return (
            <div
              key={index}
              className={`card mb-4 border-0 shadow-sm border-start border-4 ${borderClass} admin-review-q-card ${
                hidden ? "d-none" : ""
              }`}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h6 className="fw-bold text-secondary mb-0">Question {index + 1}</h6>
                  <div>
                    {statusBadge}
                    {attempted && uAns.surety !== undefined && (
                      <span className="badge bg-info text-dark ms-2">
                        Confidence: {uAns.surety}%
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="mb-3 lead"
                  style={{ fontSize: "1.1rem" }}
                  dangerouslySetInnerHTML={{
                    __html: TextFormatter.formatQuestionText(
                      q.text || q.question || "Missing question text"
                    ),
                  }}
                ></div>
                <div className="options-container ps-3">
                  {q.options.map((opt, optIdx) => {
                    let optClass = "p-2 mb-2 rounded border";
                    let icon;
                    if (optIdx === correctIndex) {
                      optClass += " bg-success text-white border-success";
                      icon = <i className="bi bi-check-circle-fill me-2"></i>;
                    } else if (attempted && uAns.answer === optIdx) {
                      optClass += " bg-danger text-white border-danger";
                      icon = <i className="bi bi-x-circle-fill me-2"></i>;
                    } else {
                      optClass += " bg-white text-dark";
                      icon = <i className="bi bi-circle me-2 text-muted"></i>;
                    }
                    return (
                      <div key={optIdx} className={optClass}>
                        {icon}
                        <span
                          dangerouslySetInnerHTML={{
                            __html: TextFormatter.formatQuestionText(opt),
                          }}
                        ></span>
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <div className="mt-3 p-3 bg-light rounded border-start border-warning border-4">
                    <h6 className="fw-bold text-warning-emphasis">
                      <i className="bi bi-lightbulb me-1"></i>Explanation
                    </h6>
                    <div
                      className="small"
                      dangerouslySetInnerHTML={{
                        __html: TextFormatter.formatQuestionText(q.explanation),
                      }}
                    ></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
