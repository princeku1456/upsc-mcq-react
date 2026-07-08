/* =========================================
   GLOBAL APP STORE (ported from auth.js)
   Holds the same global variables the vanilla app kept on window,
   plus the auth listener, theme system, morning sync and navigation.
   ========================================= */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import firebase, { auth, db, googleProvider } from "./lib/firebase";
import { DataManager } from "./lib/dataManager";
import { toastr } from "./lib/toastr";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

/* =========================================
   MORNING SYNC LOGIC (Updated) — verbatim
   ========================================= */
export async function performMorningSync() {
  console.log("🌞 Refreshing manifests and clearing cache...");

  try {
    // 1. Force Refresh Manifests (Subjects & Chapters)
    await DataManager.fetchQuizManifest(true);
    await DataManager.fetchPracticeManifest(true);

    // 2. Clear Question & Stats Cache to ensure fresh content on reload
    // This addresses the user requirement: "Refresh page = Get new data"
    await DataManager.invalidateCacheByPrefix("quiz_questions_");
    await DataManager.invalidateCacheByPrefix("practice_questions_");
    await DataManager.invalidateCacheByPrefix("global_stats_");

    console.log("✅ Sync complete. Cache invalidated.");
  } catch (error) {
    console.error("Morning sync failed:", error);
  }
}

export function AppProvider({ children }) {
  const navigate = useNavigate();

  /* ---- Global variables (mirrors auth.js section 1) ---- */
  const [currentUser, setCurrentUser] = useState(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );
  const [globalLoaderVisible, setGlobalLoaderVisible] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  // Navigation state — viewParams carries complex quiz/practice data
  const [viewParams, setViewParams] = useState({});

  // Shared mutable quiz/dashboard globals (kept in refs, exactly like
  // the module-level lets in auth.js so cross-"file" logic is unchanged)
  const g = useRef({
    userHistory: [],
    practiceHistory: [],
    dashboardDataLoaded: false,
    currentDashboardMode: "quiz",
    isPracticeMode: false,
  }).current;

  // A change counter so components re-render when histories mutate
  const [, setHistoryVersion] = useState(0);
  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), []);

  /* =========================================
     1.5 DARK MODE FUNCTIONS
     ========================================= */
  const applyTheme = useCallback((t) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("theme", t);
    setTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";
    applyTheme(newTheme);
  }, [applyTheme]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);
  }, [applyTheme]);

  /* =========================================
     NAVIGATION (uses react-router navigate)
     ========================================= */
  const showHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const showDashboard = useCallback(() => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return showHome();
    g.isPracticeMode = false;
    navigate("/dashboard");
  }, [g, showHome, navigate]);

  const showPerformance = useCallback(() => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return showHome();
    g.isPracticeMode = false;
    navigate("/performance");
  }, [g, showHome, navigate]);

  const showTestSelection = useCallback(() => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return showHome();
    g.isPracticeMode = false;
    navigate("/subjects");
  }, [g, showHome, navigate]);

  const showChapters = useCallback((subjectKey) => {
    navigate(`/subjects/${encodeURIComponent(subjectKey)}`);
  }, [navigate]);

  const startPracticeSelection = useCallback(() => {
    navigate("/practice/config");
  }, [navigate]);

  /**
   * loadQuiz — same signature and semantics as quiz.js loadQuiz().
   * The heavy lifting happens inside the QuizFlow component; here we
   * just route with the exact parameters.
   */
  const loadQuiz = useCallback(
    (subjectKey, chapterId, chapterName, reviewMode = false, pastData = null, source = null) => {
      const user = auth.currentUser;
      if (!user || !user.emailVerified) return showHome();
      g.isPracticeMode = false;
      setViewParams({
        mode: "test",
        subjectKey,
        chapterId,
        chapterName,
        reviewMode,
        pastData,
        source,
        key: Date.now(), // force remount for fresh state, like re-running loadQuiz
      });
      navigate("/quiz");
    },
    [g, showHome, navigate]
  );

  /** reviewTest — verbatim from quiz.js */
  const reviewTest = useCallback(
    (resultObj, source = "performance") => {
      const subjectPrefix = resultObj.subject.replace(/\s+/g, "_") + "_";
      const originalChapId = resultObj.chapterId.replace(subjectPrefix, "");
      loadQuiz(
        resultObj.subject,
        originalChapId,
        resultObj.chapterName,
        true,
        resultObj,
        source
      );
    },
    [loadQuiz]
  );

  /** Revision test execution routing (data prepared by the modal) */
  const startRevisionTest = useCallback((subjectKey, questions) => {
    setViewParams({
      mode: "revision",
      subjectKey,
      questions,
      key: Date.now(),
    });
    navigate("/quiz");
  }, [navigate]);

  const loadPracticeQuiz = useCallback((subject, chapter, limit) => {
    setViewParams({
      mode: "practice",
      subject,
      chapter,
      limit,
      key: Date.now(),
    });
    navigate("/quiz");
  }, [navigate]);

  const handleLogoClick = useCallback(() => {
    const user = auth.currentUser;
    if (user && user.emailVerified) showDashboard();
    else showHome();
  }, [showDashboard, showHome]);

  /* =========================================
     2. INITIALIZATION & AUTH (verbatim flow)
     ========================================= */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        user
          .reload()
          .then(() => {
            const freshUser = auth.currentUser;
            if (freshUser && !freshUser.emailVerified) {
              setCurrentUser(null);
              showHome();
              auth.signOut();
              setGlobalLoaderVisible(false);
              return;
            }
            setCurrentUser(freshUser);
            showDashboard();
            performMorningSync();
            setGlobalLoaderVisible(false);
          })
          .catch((err) => {
            console.error("Auth sync error:", err);
            auth.signOut();
            setGlobalLoaderVisible(false);
          });
      } else {
        setCurrentUser(null);
        g.userHistory = [];
        g.dashboardDataLoaded = false;
        showHome();
        setGlobalLoaderVisible(false);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Auth actions (ported verbatim from auth.js) ---- */
  function handleAuthError(error) {
    switch (error.code) {
      case "auth/email-already-in-use":
        toastr.error("This email is already registered.");
        break;
      case "auth/weak-password":
        toastr.error("Password is too weak. Min 6 characters.");
        break;
      case "auth/user-not-found":
      case "auth/wrong-password":
        toastr.error("Invalid email or password.");
        break;
      case "auth/popup-closed-by-user":
        toastr.info("Login cancelled.");
        break;
      default:
        toastr.error(error.message);
    }
  }

  const signInWithGoogle = useCallback(() => {
    auth
      .signInWithPopup(googleProvider)
      .then(() => {
        toastr.success("Signed in with Google successfully!");
      })
      .catch((error) => {
        console.error("Google Auth Error:", error);
        handleAuthError(error);
      });
  }, []);

  const submitAuthForm = useCallback(
    (email, pass) => {
      if (!email || !pass) {
        toastr.warning("Please enter both email and password.");
        return;
      }

      if (isRegistering) {
        auth
          .createUserWithEmailAndPassword(email, pass)
          .then((userCredential) => {
            userCredential.user.sendEmailVerification();
            toastr.success(
              "Account created! Please verify your email (check spam folder), then login."
            );
            setIsRegistering(false);
            auth.signOut();
          })
          .catch((err) => handleAuthError(err));
      } else {
        auth
          .signInWithEmailAndPassword(email, pass)
          .then((userCredential) => {
            if (!userCredential.user.emailVerified) {
              toastr.error(
                "Login denied: Email not verified. Please verify your email. (check spam folder)"
              );
              auth.signOut();
            } else {
              toastr.success("Logged in successfully!");
            }
          })
          .catch((err) => handleAuthError(err));
      }
    },
    [isRegistering]
  );

  const logoutUser = useCallback(() => {
    auth.signOut().then(() => {
      toastr.info("Logged out");
    });
  }, []);

  const toggleAuthMode = useCallback(() => setIsRegistering((v) => !v), []);

  const value = {
    firebase,
    auth,
    db,
    currentUser,
    theme,
    toggleTheme,
    applyTheme,
    globalLoaderVisible,
    isRegistering,
    toggleAuthMode,
    submitAuthForm,
    signInWithGoogle,
    logoutUser,
    handleLogoClick,
    // navigation
    viewParams,
    showHome,
    showDashboard,
    showPerformance,
    showTestSelection,
    showChapters,
    startPracticeSelection,
    loadQuiz,
    reviewTest,
    startRevisionTest,
    loadPracticeQuiz,
    // shared globals
    g,
    bumpHistory,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
