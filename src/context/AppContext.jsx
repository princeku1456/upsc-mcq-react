import { createContext, useContext, useEffect, useRef, useState } from 'react';
import toastr from 'toastr';
import { marked } from 'marked';
import { auth, db, googleProvider } from '../firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { DataManager } from '../lib/dataManager';
import {
  getCorrectIndex,
  calculateConfidenceStats,
  DifficultyHelper,
  formatTime,
  shuffleArray,
} from '../lib/helpers';

const AppContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

const STORAGE_THEME = 'theme';

function normalizeTimestamp(ts) {
  if (!ts) return new Date();
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') return new Date(ts);
  return new Date();
}

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState('home');
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem(STORAGE_THEME) || 'light');
  const [isRegistering, setIsRegistering] = useState(false);

  const [userHistory, setUserHistory] = useState([]);
  const [practiceHistory, setPracticeHistory] = useState([]);
  const [dashboardDataLoaded, setDashboardDataLoaded] = useState(false);
  const [dashboardMode, setDashboardMode] = useState('quiz');

  const [quizManifest, setQuizManifest] = useState(null);
  const [practiceManifest, setPracticeManifest] = useState(null);

  const [currentSubject, setCurrentSubject] = useState('');

  const [quiz, setQuiz] = useState({
    mode: 'quiz',
    data: [],
    currentIndex: 0,
    answers: {},
    marked: {},
    questionTimeSpent: {},
    submitted: false,
    subject: '',
    chapterId: '',
    chapterName: '',
    isReview: false,
    reviewSource: null,
    reviewData: null,
    timerSeconds: 0,
    timerPaused: false,
    result: null,
    resultObject: null,
  });

  const [startModal, setStartModal] = useState(null);
  const [revisionModal, setRevisionModal] = useState({ open: false, subject: '' });
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState(null);

  const timerRef = useRef(null);
  const questionStartRef = useRef(null);
  const timerCompleteRef = useRef(null);
  const quizRef = useRef(quiz);
  quizRef.current = quiz;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_THEME, theme);
  }, [theme]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        user
          .reload()
          .then(() => {
            const freshUser = auth.currentUser;
            if (freshUser && !freshUser.emailVerified) {
              setCurrentUser(null);
              setView('home');
              setBreadcrumbs([]);
              signOut(auth).catch(() => {});
              setAuthLoading(false);
              return;
            }
            setCurrentUser(freshUser);
            setView('dashboard');
            setBreadcrumbs([{ label: 'Dashboard' }]);
            performMorningSync();
            setAuthLoading(false);
          })
          .catch(() => {
            setCurrentUser(null);
            setAuthLoading(false);
            signOut(auth).catch(() => {});
          });
      } else {
        setCurrentUser(null);
        setUserHistory([]);
        setPracticeHistory([]);
        setDashboardDataLoaded(false);
        setView('home');
        setBreadcrumbs([]);
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, []);

async function performMorningSync() {
  const lastSync = localStorage.getItem('last_morning_sync');
  const today = new Date().toDateString();
  if (lastSync === today) return; // already synced today

  try {
    await DataManager.fetchQuizManifest(true);
    await DataManager.fetchPracticeManifest(true);
    localStorage.setItem('last_morning_sync', today);
  } catch (error) {
    console.error('Morning sync failed:', error);
  }
}

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }

  function applyTheme(next) {
    setTheme(next);
  }

  function setViewState(next, crumbs = []) {
    setView(next);
    setBreadcrumbs(crumbs);
  }

  function showHome() {
    setViewState('home', []);
  }

  async function showDashboard() {
    if (!currentUser || !currentUser.emailVerified) return showHome();
    setViewState('dashboard', [{ label: 'Dashboard' }]);
    await loadUserDashboard();
  }

  async function showSubjects() {
    if (!currentUser || !currentUser.emailVerified) return showHome();
    setViewState('subjects', [
      { label: 'Home', action: showHome },
      { label: 'Dashboard', action: showDashboard },
      { label: 'Take Test' },
    ]);
    let qm = quizManifest;
    if (!qm) qm = await DataManager.fetchQuizManifest();
    setQuizManifest(qm);
  }

  function showChapters(subjectKey) {
    if (!currentUser || !currentUser.emailVerified) return showHome();
    setCurrentSubject(subjectKey);
    setViewState('chapters', [
      { label: 'Home', action: showHome },
      { label: 'Dashboard', action: showDashboard },
      { label: 'Take Test', action: showSubjects },
      { label: subjectKey },
    ]);
  }

  function showPracticeSelection() {
    if (!currentUser || !currentUser.emailVerified) return showHome();
    setViewState('practice', [
      { label: 'Home', action: showHome },
      { label: 'Dashboard', action: showDashboard },
      { label: 'Practice' },
    ]);
  }

  async function loadUserDashboard(forceRefresh = false) {
    if (!currentUser || !currentUser.emailVerified) return;
    if (!forceRefresh && dashboardDataLoaded && (userHistory.length > 0 || practiceHistory.length > 0)) {
      return;
    }
    try {
      const historyData = await DataManager.syncUserHistory(currentUser.uid, forceRefresh);
      const practiceData = await DataManager.syncPracticeHistory(currentUser.uid, forceRefresh);
      if (historyData) setUserHistory(historyData);
      if (practiceData) setPracticeHistory(practiceData);
      if (historyData || practiceData) setDashboardDataLoaded(true);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toastr.error(error?.message || 'Failed to load performance data.');
    }
  }

  // ----- AUTH -----
  function toggleAuthMode() {
    setIsRegistering((v) => !v);
  }

  function handleAuthError(error) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        toastr.error('This email is already registered.');
        break;
      case 'auth/weak-password':
        toastr.error('Password is too weak. Min 6 characters.');
        break;
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        toastr.error('Invalid email or password.');
        break;
      case 'auth/popup-closed-by-user':
        toastr.info('Login cancelled.');
        break;
      default:
        toastr.error(error.message);
    }
  }

  function signInWithGoogle() {
    signInWithPopup(auth, googleProvider)
      .then(() => toastr.success('Signed in with Google successfully!'))
      .catch(handleAuthError);
  }

  async function handleEmailAuth(email, pass) {
    if (!email || !pass) {
      toastr.warning('Please enter both email and password.');
      return;
    }
    if (isRegistering) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        sendEmailVerification(cred.user).catch(() => {});
        toastr.success('Account created! Please verify your email (check spam folder), then login.');
        setIsRegistering(false);
        await signOut(auth);
      } catch (err) {
        handleAuthError(err);
      }
    } else {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        if (!cred.user.emailVerified) {
          toastr.error('Login denied: Email not verified. Please verify your email. (check spam folder)');
          await signOut(auth);
        } else {
          toastr.success('Logged in successfully!');
        }
      } catch (err) {
        handleAuthError(err);
      }
    }
  }

  function logoutUser() {
    signOut(auth).then(() => toastr.info('Logged out'));
  }

  // ----- QUIZ -----
  function saveQuizProgress() {
    const q = quizRef.current;
    if (!q.chapterId || q.submitted || q.isReview) return;
    let currentQTime = 0;
    if (questionStartRef.current) currentQTime = (Date.now() - questionStartRef.current) / 1000;
    const timeData = { ...q.questionTimeSpent };
    timeData[q.currentIndex] = (timeData[q.currentIndex] || 0) + currentQTime;
    const progressData = {
      userAnswers: q.answers,
      markedForReview: q.marked,
      questionTimeSpent: timeData,
      lastQuestionIndex: q.currentIndex,
      remainingTime: q.timerSeconds,
      timestamp: new Date().getTime(),
    };
    localStorage.setItem(`quiz_progress_${q.chapterId}`, JSON.stringify(progressData));
  }

  function clearQuizProgress(chapterId) {
    localStorage.removeItem(`quiz_progress_${chapterId}`);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer(seconds, onComplete) {
    stopTimer();
    timerCompleteRef.current = onComplete;
    quizRef.current = { ...quizRef.current, timerSeconds: seconds, timerPaused: false };
    setQuiz((q) => ({ ...q, timerSeconds: seconds, timerPaused: false }));
    timerRef.current = setInterval(() => {
      const q = quizRef.current;
      if (q.timerPaused) return;
      const next = q.timerSeconds - 1;
      if (next <= 0) {
        stopTimer();
        quizRef.current = { ...quizRef.current, timerSeconds: 0 };
        setQuiz((prev) => ({ ...prev, timerSeconds: 0 }));
        const cb = timerCompleteRef.current;
        timerCompleteRef.current = null;
        if (cb) cb();
        return;
      }
      quizRef.current = { ...quizRef.current, timerSeconds: next };
      setQuiz((prev) => ({ ...prev, timerSeconds: next }));
      saveQuizProgress();
    }, 1000);
  }

  function toggleTimerPause() {
    const q = quizRef.current;
    if (q.submitted) return;
    const paused = !q.timerPaused;
    setQuiz((prev) => ({ ...prev, timerPaused: paused }));
    toastr[paused ? 'info' : 'success'](paused ? 'Timer Paused' : 'Timer Resumed');
  }

  function openStartModal(subject, chapterName, numQuestions, savedTime, onStart) {
    setStartModal({ subject, chapter: chapterName, numQuestions, savedTime, onStart });
  }

  function closeStartModal() {
    setStartModal(null);
  }

  function clearQuizError() {
    setQuizError(null);
  }

  async function loadQuiz(subjectKey, chapterId, chapterName, reviewMode = false, pastData = null, source = null) {
    if (!currentUser || !currentUser.emailVerified) return showHome();
    setCurrentSubject(subjectKey);
    const fullChapterId = `${subjectKey.replace(/\s+/g, '_')}_${chapterId}`;
    const decodedName = decodeURIComponent(chapterName);

    const crumbs = reviewMode
      ? source === 'performance'
        ? [
            { label: 'Home', action: showHome },
            { label: 'Dashboard', action: showDashboard },
            { label: 'Performance', action: showDashboard },
            { label: 'Review: ' + decodedName },
          ]
        : [
            { label: 'Home', action: showHome },
            { label: 'Dashboard', action: showDashboard },
            { label: 'Take Test', action: showSubjects },
            { label: subjectKey, action: () => showChapters(subjectKey) },
            { label: 'Review: ' + decodedName },
          ]
      : [
          { label: 'Home', action: showHome },
          { label: 'Dashboard', action: showDashboard },
          { label: 'Take Test', action: showSubjects },
          { label: subjectKey, action: () => showChapters(subjectKey) },
          { label: decodedName },
        ];
    setBreadcrumbs(crumbs);
    setQuizError(null);
    setQuizLoading(true);

    try {
      const questions = await DataManager.fetchQuizQuestions(fullChapterId);
      if (!questions) {
        toastr.error('Quiz questions not found in database!');
        closeStartModal();
        showDashboard();
        return;
      }

      let savedTime = null;
      let savedProgress = null;
      if (!reviewMode) {
        const raw = localStorage.getItem(`quiz_progress_${fullChapterId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (new Date().getTime() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            savedProgress = parsed;
            savedTime = parsed.remainingTime;
            toastr.info('Restored your previous progress and time.');
          }
        }
      }

      const initialAnswers = reviewMode && pastData ? pastData.userAnswers || {} : savedProgress?.userAnswers || {};
      const initialMarked = reviewMode && pastData ? {} : savedProgress?.markedForReview || {};
      const initialTimeSpent = reviewMode && pastData ? pastData.questionTimeSpent || {} : savedProgress?.questionTimeSpent || {};
      const initialIndex = reviewMode ? 0 : savedProgress?.lastQuestionIndex || 0;

      const quizState = {
        mode: 'quiz',
        data: questions,
        currentIndex: initialIndex,
        answers: initialAnswers,
        marked: initialMarked,
        questionTimeSpent: initialTimeSpent,
        submitted: reviewMode,
        subject: subjectKey,
        chapterId: fullChapterId,
        chapterName: decodedName,
        isReview: reviewMode,
        reviewSource: source,
        reviewData: reviewMode ? pastData : null,
        timerSeconds: 0,
        timerPaused: false,
        result: null,
        resultObject: reviewMode ? pastData : null,
        timerComplete: null,
      };

      if (reviewMode) {
        setQuiz(quizState);
        setView('review');
      } else {
        setQuiz(quizState);
        setView('chapters');
        const durationMin = Math.ceil(questions.length * 1.2);
        openStartModal(subjectKey, decodedName, questions.length, savedTime, () => {
          startQuizExecution(savedTime);
        });
      }
    } catch (error) {
      console.error('Firebase fetch error:', error);
      const message = error?.message || 'Failed to load questions.';
      setQuizError(message);
      toastr.error(message);
      showDashboard();
    } finally {
      setQuizLoading(false);
    }
  }

  function startQuizExecution(savedTime) {
    closeStartModal();
    stopTimer();
    questionStartRef.current = Date.now();
    const duration = savedTime !== null ? savedTime : Math.floor(quizRef.current.data.length * 1.2 * 60);
    setView('quiz');
    setBreadcrumbs((prev) => prev);
    startTimer(duration, () => submitAll(true));
  }

  function reviewTest(resultObj, source = 'performance') {
    const subjectPrefix = resultObj.subject.replace(/\s+/g, '_') + '_';
    const originalChapId = resultObj.chapterId.replace(subjectPrefix, '');
    loadQuiz(resultObj.subject, originalChapId, resultObj.chapterName, true, resultObj, source);
  }

  function updateQuestionTimer() {
    const q = quizRef.current;
    if (!questionStartRef.current || q.submitted || q.isReview) return;
    const now = Date.now();
    const elapsed = (now - questionStartRef.current) / 1000;
    const timeSpent = { ...q.questionTimeSpent };
    timeSpent[q.currentIndex] = (timeSpent[q.currentIndex] || 0) + elapsed;
    setQuiz((prev) => ({ ...prev, questionTimeSpent: timeSpent }));
    questionStartRef.current = now;
  }

  function selectAnswer(index) {
    const q = quizRef.current;
    if (q.submitted) return;
    const answers = { ...q.answers };
    if (!answers[q.currentIndex]) answers[q.currentIndex] = {};
    answers[q.currentIndex].answer = index;
    setQuiz((prev) => ({ ...prev, answers }));
    setTimeout(saveQuizProgress, 0);
  }

  function setSurety(val) {
    const q = quizRef.current;
    if (q.submitted) return;
    const answers = { ...q.answers };
    if (!answers[q.currentIndex]) answers[q.currentIndex] = { answer: -1 };
    answers[q.currentIndex].surety = val;
    setQuiz((prev) => ({ ...prev, answers }));
    setTimeout(saveQuizProgress, 0);
  }

  function toggleMarkForReview() {
    const q = quizRef.current;
    if (q.submitted) return;
    const marked = { ...q.marked };
    if (marked[q.currentIndex]) {
      delete marked[q.currentIndex];
      toastr.info('Removed from Review');
    } else {
      marked[q.currentIndex] = true;
      toastr.success('Marked for Review');
    }
    setQuiz((prev) => ({ ...prev, marked }));
    setTimeout(saveQuizProgress, 0);
  }

  function navigateQuestions(dir) {
    const q = quizRef.current;
    const next = q.currentIndex + dir;
    if (next >= 0 && next < q.data.length) {
      updateQuestionTimer();
      setQuiz((prev) => ({ ...prev, currentIndex: next }));
      questionStartRef.current = Date.now();
      setTimeout(saveQuizProgress, 0);
    }
  }

  function goToQuestion(index) {
    const q = quizRef.current;
    if (index < 0 || index >= q.data.length) return;
    updateQuestionTimer();
    setQuiz((prev) => ({ ...prev, currentIndex: index }));
    questionStartRef.current = Date.now();
    setTimeout(saveQuizProgress, 0);
  }

  function clearSelection() {
    const q = quizRef.current;
    if (q.submitted) return;
    const answers = { ...q.answers };
    delete answers[q.currentIndex];
    setQuiz((prev) => ({ ...prev, answers }));
    setTimeout(saveQuizProgress, 0);
  }

  async function submitAll(forceSubmit = false) {
    if (!forceSubmit && !window.confirm('Are you sure you want to submit?')) return;
    stopTimer();
    updateQuestionTimer();

    const q = quizRef.current;
    clearQuizProgress(q.chapterId);

    let score = 0;
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;

    const answers = { ...q.answers };
    q.data.forEach((question, i) => {
      const uAns = answers[i];
      const cIdx = getCorrectIndex(question);
      if (uAns) {
        const isCorrect = uAns.answer === cIdx;
        answers[i] = { ...uAns, isCorrect };
        if (isCorrect) {
          score += 2;
          correct++;
        } else {
          score -= 0.66;
          incorrect++;
        }
      } else {
        unattempted++;
      }
    });

    const finalScore = parseFloat(score.toFixed(2));
    const totalMarks = q.data.length * 2;
    const percentage = totalMarks > 0 ? parseFloat(((finalScore / totalMarks) * 100).toFixed(1)) : 0;
    const now = new Date();

    const resultObject = {
      userId: currentUser ? currentUser.uid : 'guest',
      userEmail: currentUser ? currentUser.email : 'guest',
      subject: q.subject,
      chapterId: q.chapterId,
      chapterName: q.chapterName,
      score: finalScore,
      totalMarks,
      scorePercent: percentage,
      userAnswers: answers,
      questionTimeSpent: q.questionTimeSpent,
      timestamp: now,
    };

    const result = { score: finalScore, totalMarks, percentage, correct, incorrect, unattempted, resultObject };

    setQuiz((prev) => ({
      ...prev,
      answers,
      submitted: true,
      result,
      resultObject,
      timerSeconds: 0,
    }));

    if (currentUser) {
      try {
        const docRef = await addDoc(collection(db, 'results'), { ...resultObject, timestamp: serverTimestamp() });
        setUserHistory((prev) => {
          const next = [{ ...resultObject, id: docRef.id, timestamp: now }, ...prev];
          return next.slice(0, 20);
        });
        setDashboardDataLoaded(true);
        await DataManager.invalidateCache(`global_stats_${q.chapterId}`);
        await DataManager.invalidateCache(`user_history_${currentUser.uid}`);

        if (!q.chapterId.startsWith('revision_')) {
          const statsRef = doc(db, 'chapter_stats', q.chapterId);
          try {
            await runTransaction(db, async (transaction) => {
              const sfDoc = await transaction.get(statsRef);
              const newScore = percentage;
              const leaderboardEntry = {
                userEmail: currentUser.email,
                scorePercent: percentage,
                score: finalScore,
                rankTime: now.toISOString(),
                resultId: docRef.id,
              };
              if (!sfDoc.exists()) {
                const initCorrectCounts = q.data.map((question, i) =>
                  answers[i] && answers[i].answer === getCorrectIndex(question) ? 1 : 0,
                );
                const initAttemptedCounts = q.data.map((question, i) => (answers[i] ? 1 : 0));
                transaction.set(statsRef, {
                  totalScore: newScore,
                  totalAttempts: 1,
                  average: newScore,
                  highestScore: newScore,
                  allScores: [newScore],
                  leaderboard: [leaderboardEntry],
                  correctCounts: initCorrectCounts,
                  attemptedCounts: initAttemptedCounts,
                });
              } else {
                const data = sfDoc.data();
                const newAttempts = (data.totalAttempts || 0) + 1;
                const newAvg = ((data.totalScore || 0) + newScore) / newAttempts;
                let currentLeaderboard = data.leaderboard || [];
                currentLeaderboard.push(leaderboardEntry);
                currentLeaderboard.sort((a, b) => b.scorePercent - a.scorePercent);
                if (currentLeaderboard.length > 10) currentLeaderboard = currentLeaderboard.slice(0, 10);

                let cCounts = [...(data.correctCounts || [])];
                let aCounts = [...(data.attemptedCounts || [])];
                const maxLen = Math.max(cCounts.length, aCounts.length, q.data.length);
                for (let j = 0; j < maxLen; j++) {
                  if (cCounts[j] == null) cCounts[j] = 0;
                  if (aCounts[j] == null) aCounts[j] = 0;
                }
                q.data.forEach((question, i) => {
                  if (answers[i]) {
                    aCounts[i] = (aCounts[i] || 0) + 1;
                    if (answers[i].answer === getCorrectIndex(question)) cCounts[i] = (cCounts[i] || 0) + 1;
                  }
                });
                transaction.update(statsRef, {
                  totalScore: (data.totalScore || 0) + newScore,
                  totalAttempts: newAttempts,
                  average: newAvg,
                  highestScore: Math.max(data.highestScore || 0, newScore),
                  allScores: [...(data.allScores || []), newScore],
                  leaderboard: currentLeaderboard,
                  correctCounts: cCounts,
                  attemptedCounts: aCounts,
                });
              }
            });
            toastr.success('Result and stats saved!');
          } catch (e) {
            console.error('Stats update failed:', e);
          }
        } else {
          toastr.success('Revision test result saved!');
        }
      } catch (error) {
        console.error('Error saving result:', error);
        toastr.error('Failed to save result.');
      }
    }
  }

  function exitQuiz() {
    stopTimer();
    const q = quizRef.current;
    if (q.mode === 'practice') {
      showPracticeSelection();
      return;
    }
    if (q.isReview && q.reviewSource === 'performance') {
      showDashboard();
    } else if (q.subject && quizManifest && quizManifest[q.subject]) {
      showChapters(q.subject);
    } else {
      showDashboard();
    }
  }

  // ----- REVISION TEST -----
  function openRevisionModal(subjectKey) {
    setRevisionModal({ open: true, subject: subjectKey });
  }

  function closeRevisionModal() {
    setRevisionModal({ open: false, subject: '' });
  }

  async function generateRevisionTest(subjectKey, selectedChapters, filterType) {
    if (!selectedChapters.length) {
      toastr.warning('Please select at least one test.');
      return;
    }
    const latestResultsMap = new Map();
    userHistory.forEach((h) => {
      if (!latestResultsMap.has(h.chapterId)) latestResultsMap.set(h.chapterId, h);
    });

    try {
      let combinedQuestions = [];
      const subjectPrefix = subjectKey.replace(/\s+/g, '_') + '_';
      for (const chapId of selectedChapters) {
        const fullChapterId = subjectPrefix + chapId;
        const questions = await DataManager.fetchQuizQuestions(fullChapterId);
        if (questions && questions.length > 0) {
          const latestResult = latestResultsMap.get(fullChapterId);
          const taggedQuestions = questions
            .map((q, qIndex) => {
              let include = true;
              if (filterType !== 'all') {
                if (!latestResult) {
                  if (filterType === 'correct' || filterType === 'incorrect') include = false;
                  else if (filterType === 'unattempted') include = true;
                } else {
                  const uAns = latestResult.userAnswers && latestResult.userAnswers[qIndex];
                  if (!uAns) {
                    include = filterType === 'unattempted';
                  } else {
                    const correctIndex = getCorrectIndex(q);
                    const isCorrect = uAns.answer === correctIndex;
                    if (filterType === 'correct' && !isCorrect) include = false;
                    if (filterType === 'incorrect' && isCorrect) include = false;
                    if (filterType === 'unattempted') include = false;
                  }
                }
              }
              return include ? { ...q, subject: q.subject || subjectKey } : null;
            })
            .filter((q) => q !== null);
          combinedQuestions = combinedQuestions.concat(taggedQuestions);
        }
      }

      if (combinedQuestions.length === 0) {
        toastr.error('No questions found matching your filter criteria.');
        return;
      }

      const shuffled = shuffleArray(combinedQuestions).slice(0, 100);
      const chapterId = 'revision_' + Date.now();
      setCurrentSubject(subjectKey);
      closeRevisionModal();
      setQuiz({
        mode: 'quiz',
        data: shuffled,
        currentIndex: 0,
        answers: {},
        marked: {},
        questionTimeSpent: {},
        submitted: false,
        subject: subjectKey,
        chapterId,
        chapterName: 'Revision Test',
        isReview: false,
        reviewSource: null,
        reviewData: null,
        timerSeconds: 0,
        timerPaused: false,
        result: null,
        resultObject: null,
        timerComplete: null,
      });
      setBreadcrumbs([
        { label: 'Home', action: showHome },
        { label: 'Dashboard', action: showDashboard },
        { label: 'Take Test', action: showSubjects },
        { label: subjectKey, action: () => showChapters(subjectKey) },
        { label: 'Revision Test' },
      ]);
      setView('quiz');
      questionStartRef.current = Date.now();
      startTimer(Math.floor(shuffled.length * 1.2 * 60), () => submitAll(true));
    } catch (error) {
      console.error('Error generating revision test:', error);
      toastr.error('Failed to generate test.');
    }
  }

  // ----- PRACTICE -----
  async function loadPracticeQuiz(subject, chapter, limit) {
    const practiceChapter = chapter === 'all' ? 'All Topics' : chapter;
    setView('quiz');
    setBreadcrumbs([
      { label: 'Home', action: showHome },
      { label: 'Dashboard', action: showDashboard },
      { label: 'Practice', action: showPracticeSelection },
      { label: subject + ' - ' + practiceChapter },
    ]);

    try {
      let manifest = practiceManifest;
      if (!manifest) manifest = await DataManager.fetchPracticeManifest();
      setPracticeManifest(manifest);
      const chapterIds = chapter === 'all' ? Object.keys(manifest[subject] || {}) : [chapter];
      const promises = chapterIds.map((chapId) => {
        const docId = `${subject.replace(/\s+/g, '_')}_${chapId}`;
        return DataManager.fetchPracticeQuestions(docId);
      });
      const results = await Promise.all(promises);
      const allQuestions = results.flat();
      if (allQuestions.length === 0) {
        toastr.error('No questions available.');
        showPracticeSelection();
        return;
      }
      const randomized = shuffleArray(allQuestions).slice(0, Math.min(limit, allQuestions.length));

      setQuiz({
        mode: 'practice',
        data: randomized,
        currentIndex: 0,
        answers: {},
        marked: {},
        questionTimeSpent: {},
        submitted: false,
        subject,
        chapterId: 'practice_session',
        chapterName: practiceChapter,
        isReview: false,
        reviewSource: null,
        reviewData: null,
        timerSeconds: 0,
        timerPaused: false,
        result: null,
        resultObject: null,
        timerComplete: null,
      });
      questionStartRef.current = Date.now();
      startTimer(Math.floor(limit * 1.2 * 60), () => submitPractice(true));
    } catch (error) {
      console.error('Fetch Error:', error);
      toastr.error('Failed to load questions.');
      showPracticeSelection();
    }
  }

  function selectPracticeAnswer(index) {
    const q = quizRef.current;
    if (q.submitted) return;
    const answers = { ...q.answers };
    if (!answers[q.currentIndex]) answers[q.currentIndex] = {};
    answers[q.currentIndex].answer = index;
    setQuiz((prev) => ({ ...prev, answers }));
  }

  function setPracticeSurety(val) {
    const q = quizRef.current;
    if (q.submitted) return;
    const answers = { ...q.answers };
    if (!answers[q.currentIndex]) answers[q.currentIndex] = { answer: -1 };
    answers[q.currentIndex].surety = val;
    setQuiz((prev) => ({ ...prev, answers }));
  }

  function togglePracticeMarkForReview() {
    const q = quizRef.current;
    if (q.submitted) return;
    const marked = { ...q.marked };
    if (marked[q.currentIndex]) {
      delete marked[q.currentIndex];
      toastr.info('Removed from Review');
    } else {
      marked[q.currentIndex] = true;
      toastr.success('Marked for Review');
    }
    setQuiz((prev) => ({ ...prev, marked }));
  }

  function navigatePractice(dir) {
    const q = quizRef.current;
    const next = q.currentIndex + dir;
    if (next >= 0 && next < q.data.length) {
      setQuiz((prev) => ({ ...prev, currentIndex: next }));
    }
  }

  function goToPracticeQuestion(index) {
    const q = quizRef.current;
    if (index < 0 || index >= q.data.length) return;
    setQuiz((prev) => ({ ...prev, currentIndex: index }));
  }

  function clearPracticeSelection() {
    const q = quizRef.current;
    if (q.submitted) return;
    const answers = { ...q.answers };
    delete answers[q.currentIndex];
    setQuiz((prev) => ({ ...prev, answers }));
  }

  async function submitPractice(forceSubmit = false) {
    if (!forceSubmit && !window.confirm('Finish this practice session?')) return;
    stopTimer();
    const q = quizRef.current;
    let score = 0;
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;

    const answers = { ...q.answers };
    q.data.forEach((question, i) => {
      const uAns = answers[i];
      const cIdx = getCorrectIndex(question);
      if (uAns && uAns.answer !== undefined && uAns.answer !== -1) {
        const isCorrect = uAns.answer === cIdx;
        answers[i] = { ...uAns, isCorrect };
        if (isCorrect) {
          score += 2;
          correct++;
        } else {
          score -= 0.66;
          incorrect++;
        }
      } else {
        unattempted++;
      }
    });

    const totalQuestions = q.data.length;
    const totalPossibleMarks = totalQuestions * 2;
    const accuracy = parseFloat(((correct / (correct + incorrect)) * 100 || 0).toFixed(1));
    const negativeLoss = incorrect * 0.66;
    const positiveGain = correct * 2;
    const negativeDrain = positiveGain ? parseFloat(((negativeLoss / positiveGain) * 100).toFixed(1)) : 0;

    const result = {
      score: parseFloat(score.toFixed(2)),
      totalPossibleMarks,
      accuracy,
      negativeDrain,
      correct,
      incorrect,
      unattempted,
    };

    setQuiz((prev) => ({ ...prev, answers, submitted: true, result, timerSeconds: 0 }));

    if (currentUser) {
      const resultData = {
        userId: currentUser.uid,
        timestamp: serverTimestamp(),
        subject: q.subject,
        chapterName: q.chapterName,
        chapterId: 'practice_session',
        scorePercent: accuracy,
        totalMarks: totalPossibleMarks,
        userAnswers: answers,
        correctCount: correct,
        incorrectCount: incorrect,
        unattemptedCount: unattempted,
      };
      try {
        const docRef = await addDoc(collection(db, 'practiceResult'), resultData);
        toastr.success('Practice result saved!');
        setPracticeHistory((prev) => [
          { id: docRef.id, ...resultData, timestamp: new Date() },
          ...prev,
        ]);
        await DataManager.invalidateCache(`user_practice_history_${currentUser.uid}`);
      } catch (error) {
        console.error('Error saving practice result:', error);
        toastr.error('Failed to save result.');
      }
    }
  }

  // ----- AI REVIEW -----
  async function generateAIReview() {
    const key = await DataManager.fetchGeminiKey();
    const GEMINI_MODEL = 'gemini-flash-latest';
    if (!key || key === 'YOUR_GEMINI_API_KEY_HERE') {
      toastr.warning('AI Service not configured. Please contact support.');
      return null;
    }

    const history = userHistory;
    if (!history || history.length === 0) {
      toastr.error('No test history available to analyze.');
      return null;
    }

    const totalTests = history.length;
    let totalScoreSum = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalAttempted = 0;
    const subjectStats = {};
    const allTestsDetailedArray = [];

    for (const r of history) {
      totalScoreSum += r.scorePercent;
      if (!subjectStats[r.subject]) subjectStats[r.subject] = { totalScore: 0, count: 0 };
      subjectStats[r.subject].totalScore += r.scorePercent;
      subjectStats[r.subject].count++;

      let correct = 0;
      let incorrect = 0;
      if (r.userAnswers) {
        Object.values(r.userAnswers).forEach((ans) => {
          if (!ans) return;
          totalAttempted++;
          if (ans.isCorrect) {
            totalCorrect++;
            correct++;
          } else {
            totalIncorrect++;
            incorrect++;
          }
        });
      }
      const totalQs = r.totalMarks ? r.totalMarks / 2 : correct + incorrect;
      const unattempted = Math.max(0, totalQs - (correct + incorrect));
      const dateStr = r.timestamp
        ? normalizeTimestamp(r.timestamp).toLocaleDateString()
        : 'Unknown Date';
      allTestsDetailedArray.push(
        `- ${dateStr}: ${r.chapterName} (${r.subject})\n  Score: ${r.scorePercent}% | Breakdown: ${correct} Correct, ${incorrect} Incorrect, ${unattempted} Unattempted.`,
      );
    }

    const avgScore = totalTests ? (totalScoreSum / totalTests).toFixed(1) + '%' : '0%';
    const precision = totalAttempted ? ((totalCorrect / totalAttempted) * 100).toFixed(1) + '%' : '0%';
    const negativeLoss = totalIncorrect * 0.66;
    const positiveGain = totalCorrect * 2;
    const drain = (positiveGain ? ((negativeLoss / positiveGain) * 100).toFixed(1) : 0) + '%';

    let weakestSubject = 'N/A';
    let weakestScore = 100;
    Object.entries(subjectStats).forEach(([subj, data]) => {
      const avg = data.totalScore / data.count;
      if (avg < weakestScore) {
        weakestScore = avg;
        weakestSubject = `${subj} (${avg.toFixed(1)}%)`;
      }
    });

    const prompt = `
Act as the **Lead Academic Strategist** for a premier UPSC Civil Services coaching institute. Your objective is to conduct a **Clinical Performance Audit** for a student using the psychometric and academic datasets provided below.

### **1. STUDENT PERFORMANCE DATASET**
**Core Metrics:**
- **Stamina (Total Tests):** ${totalTests}
- **Baseline Competency (Avg Score):** ${avgScore}
- **Efficiency Index (Precision/Accuracy):** ${precision}
- **Risk Impact (Negative Drain):** ${drain}
- **High-Priority Weakness:** ${weakestSubject}

**Raw Longitudinal History:**
${allTestsDetailedArray.join('\n')}

---

### **2. ANALYTICAL REQUIREMENTS & INSTRUCTIONS**
Perform your analysis using a **data-first diagnostic approach**. Your review MUST include:

#### **A. Root Cause Analysis (RCA): Weakest Subject**
Diagnose if the failure in **${weakestSubject}** is due to *Conceptual Fog* or *Application Failure*. Provide a 3-step hierarchical fix (Foundational → Applied → Simulated).

#### **B. Behavioral Response Mapping**
Scan the **Longitudinal History** for psychological trends:
- **Fatigue Decay:** Do scores drop in later tests or during specific streaks?
- **The Guesswork Trap:** Compare 'Precision' vs 'Negative Drain'.
- **Volatility vs. Plateau:** Is the student consistently average or experiencing wild swings?

#### **C. The 48-Hour Tactical Roadmap**
Provide exactly **3 SMART Tasks** for the very next study session.

### **3. STYLE & TONE CONSTRAINTS**
- **Tone:** authoritative, clinical, data-driven, yet encouraging.
- **Formatting:** Use **Bold** for critical insights and bullets for techniques.
- **Goal:** Move the student from "Hard Work" to "Precision Work."
`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Failed to fetch AI response');
      }
      const data = await response.json();
      const aiText = data.candidates[0].content.parts[0].text;
      return marked.parse(aiText);
    } catch (error) {
      console.error('AI Error:', error);
      toastr.error('AI Analysis Failed: ' + error.message);
      return null;
    }
  }

  const value = {
    currentUser,
    authLoading,
    view,
    breadcrumbs,
    theme,
    isRegistering,
    userHistory,
    practiceHistory,
    dashboardMode,
    quizManifest,
    practiceManifest,
    currentSubject,
    quiz,
    startModal,
    revisionModal,
    quizLoading,
    quizError,
    clearQuizError,

    toggleTheme,
    applyTheme,
    showHome,
    showDashboard,
    showSubjects,
    showChapters,
    showPracticeSelection,
    loadUserDashboard,
    toggleAuthMode,
    signInWithGoogle,
    handleEmailAuth,
    logoutUser,
    setDashboardMode,

    loadQuiz,
    reviewTest,
    startQuizExecution,
    openStartModal,
    closeStartModal,
    openRevisionModal,
    closeRevisionModal,
    generateRevisionTest,
    exitQuiz,

    selectAnswer,
    setSurety,
    toggleMarkForReview,
    navigateQuestions,
    goToQuestion,
    clearSelection,
    submitAll,
    toggleTimerPause,

    loadPracticeQuiz,
    selectPracticeAnswer,
    setPracticeSurety,
    togglePracticeMarkForReview,
    navigatePractice,
    goToPracticeQuestion,
    clearPracticeSelection,
    submitPractice,

    generateAIReview,
    formatTime,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
