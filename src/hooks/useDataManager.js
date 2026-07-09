import { useState, useCallback } from "react";
import { DataManager } from "../lib/dataManager";

export function useQuizManifest() {
  const [data, setData] = useState(() => DataManager.cache.quizManifest || null);
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && data) return data;
    setLoading(true);
    try {
      const result = await DataManager.fetchQuizManifest(forceRefresh);
      setData(result);
      setError(null);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [data]);

  return { manifest: data, loading, error, fetchManifest: fetch };
}

export function useQuizQuestions(chapterId) {
  const [data, setData] = useState(() =>
    chapterId ? DataManager.cache.quizzes[chapterId] || null : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (id) => {
    if (!id) return null;
    if (DataManager.cache.quizzes[id]) {
      setData(DataManager.cache.quizzes[id]);
      return DataManager.cache.quizzes[id];
    }
    setLoading(true);
    try {
      const result = await DataManager.fetchQuizQuestions(id);
      setData(result);
      setError(null);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { questions: data, loading, error, fetchQuestions: fetch };
}

export function useGlobalStats(chapterId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (id, forceRefresh = false) => {
    if (!id) return null;
    setLoading(true);
    try {
      const result = await DataManager.fetchGlobalStats(id, forceRefresh);
      setData(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats: data, loading, fetchStats: fetch };
}

export function useUserHistory(userId) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (uid, forceRefresh = false) => {
    if (!uid) return [];
    setLoading(true);
    try {
      const result = await DataManager.syncUserHistory(uid, forceRefresh);
      setData(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { history: data, loading, fetchHistory: fetch };
}

export function useGeminiKey() {
  const [key, setKey] = useState(null);

  const fetch = useCallback(async () => {
    if (key) return key;
    const result = await DataManager.fetchGeminiKey();
    setKey(result);
    return result;
  }, [key]);

  return { geminiKey: key, fetchGeminiKey: fetch };
}
