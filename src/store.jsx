import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { auth, db, googleProvider } from "./lib/firebase";
import { DataManager } from "./lib/dataManager";
import { toastr } from "./lib/toastr";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export async function performMorningSync() {
  console.log("🌞 Refreshing manifests and clearing cache...");
  try {
    await DataManager.fetchQuizManifest(true);
    await DataManager.invalidateCacheByPrefix("quiz_questions_");
    await DataManager.invalidateCacheByPrefix("global_stats_");
    console.log("✅ Sync complete. Cache invalidated.");
  } catch (error) {
    console.error("Morning sync failed:", error);
  }
}

export function AppProvider({ children }) {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "light"
  );
  const [globalLoaderVisible, setGlobalLoaderVisible] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [viewParams, setViewParams] = useState({});

  const g = useRef({
    userHistory: [],
    dashboardDataLoaded: false,
  }).current;

  const [, setHistoryVersion] = useState(0);
  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), []);

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

  const showHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const showDashboard = useCallback(() => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return showHome();
    navigate("/dashboard");
  }, [showHome, navigate]);

  const showTestSelection = useCallback(() => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) return showHome();
    navigate("/subjects");
  }, [showHome, navigate]);

  const showChapters = useCallback((subjectKey) => {
    navigate(`/subjects/${encodeURIComponent(subjectKey)}`);
  }, [navigate]);

  const loadQuiz = useCallback(
    (subjectKey, chapterId, chapterName, reviewMode = false, pastData = null, source = null) => {
      const user = auth.currentUser;
      if (!user || !user.emailVerified) return showHome();
      setViewParams({
        mode: "test",
        subjectKey,
        chapterId,
        chapterName,
        reviewMode,
        pastData,
        source,
        key: Date.now(),
      });
      navigate("/quiz");
    },
    [showHome, navigate]
  );

  const reviewTest = useCallback(
    (resultObj, source = "performance") => {
      const subjectPrefix = resultObj.subject.replace(/\s+/g, "_") + "_";
      const originalChapId = resultObj.chapterId.replace(subjectPrefix, "");
      loadQuiz(resultObj.subject, originalChapId, resultObj.chapterName, true, resultObj, source);
    },
    [loadQuiz]
  );

  const startRevisionTest = useCallback((subjectKey, questions) => {
    setViewParams({ mode: "revision", subjectKey, questions, key: Date.now() });
    navigate("/quiz");
  }, [navigate]);

  const handleLogoClick = useCallback(() => {
    const user = auth.currentUser;
    if (user && user.emailVerified) showDashboard();
    else showHome();
  }, [showDashboard, showHome]);

  // Keep always-current references to the navigation helpers so the auth
  // listener below can subscribe ONCE and never needs them in its deps.
  // (With <BrowserRouter>, `navigate` — and therefore showHome/showDashboard —
  // gets a new identity on every URL change. If the auth effect depended on
  // them it would re-subscribe on every navigation, and each fresh
  // onAuthStateChanged subscription fires immediately with the current user,
  // re-triggering showDashboard() and bouncing the user back to /dashboard.)
  const showHomeRef = useRef(showHome);
  const showDashboardRef = useRef(showDashboard);
  const initialAuthDoneRef = useRef(false);
  useEffect(() => {
    showHomeRef.current = showHome;
    showDashboardRef.current = showDashboard;
  });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        if (user.emailVerified === false) {
          setCurrentUser(null);
          showHomeRef.current();
          auth.signOut();
          setGlobalLoaderVisible(false);
          return;
        }
        setCurrentUser(user);
        if (!initialAuthDoneRef.current) {
          initialAuthDoneRef.current = true;
          showDashboardRef.current();
          performMorningSync();
        }
        setGlobalLoaderVisible(false);
      } else {
        setCurrentUser(null);
        g.userHistory = [];
        g.dashboardDataLoaded = false;
        initialAuthDoneRef.current = false;
        showHomeRef.current();
        setGlobalLoaderVisible(false);
      }
    });
    return unsub;
    // Intentionally empty deps: subscribe once for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      .then(() => toastr.success("Signed in with Google successfully!"))
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
        auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
          userCredential.user.sendEmailVerification();
          toastr.success("Account created! Please verify your email (check spam folder), then login.");
          setIsRegistering(false);
          auth.signOut();
        }).catch((err) => handleAuthError(err));
      } else {
        auth.signInWithEmailAndPassword(email, pass).then((userCredential) => {
          if (!userCredential.user.emailVerified) {
            toastr.error("Login denied: Email not verified. Please verify your email. (check spam folder)");
            auth.signOut();
          } else {
            toastr.success("Logged in successfully!");
          }
        }).catch((err) => handleAuthError(err));
      }
    },
    [isRegistering]
  );

  const logoutUser = useCallback(() => {
    auth.signOut().then(() => toastr.info("Logged out"));
  }, []);

  const toggleAuthMode = useCallback(() => setIsRegistering((v) => !v), []);

  const value = {
    firebase: null,
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
    viewParams,
    showHome,
    showDashboard,
    showTestSelection,
    showChapters,
    loadQuiz,
    reviewTest,
    startRevisionTest,
    g,
    bumpHistory,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}