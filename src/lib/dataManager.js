import { db } from '../firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  endBefore,
  getDocs,
} from 'firebase/firestore';

const DB_CONFIG = {
  name: 'QuizAppDB',
  version: 1,
  storeName: 'app_cache',
};

const IDB = {
  dbPromise: null,

  open() {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        this.dbPromise = null;
        reject('IndexedDB failed to open');
      };

      request.onblocked = () => {
        this.dbPromise = null;
      };

      request.onsuccess = (event) => {
        const idb = event.target.result;

        // Reset the cached promise so future calls reopen a fresh connection
        // if the browser closes this one (tab teardown, HMR, version change).
        idb.onclose = () => {
          this.dbPromise = null;
        };
        idb.onversionchange = () => {
          try {
            idb.close();
          } catch (e) {
            // ignore
          }
          this.dbPromise = null;
        };

        resolve(idb);
      };

      request.onupgradeneeded = (event) => {
        const idb = event.target.result;
        if (!idb.objectStoreNames.contains(DB_CONFIG.storeName)) {
          idb.createObjectStore(DB_CONFIG.storeName, { keyPath: 'key' });
        }
      };
    });
    return this.dbPromise;
  },

  async withConnection(mode, fn) {
    let idb;
    try {
      idb = await this.open();
      if (!idb || (typeof idb.objectStoreNames !== 'undefined' && !idb.objectStoreNames.contains(DB_CONFIG.storeName))) {
        throw new Error('IndexedDB unavailable');
      }
    } catch (e) {
      this.dbPromise = null;
      try {
        idb = await this.open();
      } catch (e2) {
        throw e;
      }
    }

    return new Promise((resolve, reject) => {
      let transaction;
      try {
        transaction = idb.transaction([DB_CONFIG.storeName], mode);
      } catch (e) {
        this.dbPromise = null;
        reject(e);
        return;
      }
      const store = transaction.objectStore(DB_CONFIG.storeName);
      const request = fn(store, transaction);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async get(key) {
    try {
      return await this.withConnection('readonly', (store) => store.get(key));
    } catch (e) {
      console.error('IDB Get Error', e);
      return null;
    }
  },

  async set(key, data) {
    try {
      await this.withConnection('readwrite', (store) => store.put({ key, ...data }));
    } catch (e) {
      console.error('IDB Set Error', e);
    }
  },

  async delete(key) {
    try {
      await this.withConnection('readwrite', (store) => store.delete(key));
    } catch (e) {
      console.error('IDB Delete Error', e);
    }
  },

  async getAllKeys() {
    try {
      return await this.withConnection('readonly', (store) => store.getAllKeys());
    } catch (e) {
      console.error('IDB GetAllKeys Error', e);
      return [];
    }
  },
};

const cache = {
  quizManifest: null,
  practiceManifest: null,
  quizzes: {},
  practice: {},
  geminiKey: null,
  globalStats: {},
};

async function fetchWithCache(key, fetcher, ttl = 86400000, forceRefresh = false) {
  if (!forceRefresh) {
    const cachedEntry = await IDB.get(key);
    if (cachedEntry) {
      const age = Date.now() - cachedEntry.timestamp;
      if (age < ttl) return cachedEntry.data;
    }
  }

  try {
    const data = await fetcher();
    if (data !== null && data !== undefined) {
      await IDB.set(key, { data, timestamp: Date.now() });
      return data;
    }
  } catch (error) {
    console.error(`Error fetching data for ${key}:`, error);
  }
  return null;
}

export const DataManager = {
  cache,

  async invalidateCache(key) {
    await IDB.delete(key);
  },

  async invalidateCacheByPrefix(prefix) {
    const keys = await IDB.getAllKeys();
    const promises = keys
      .filter((key) => typeof key === 'string' && key.startsWith(prefix))
      .map((key) => IDB.delete(key));
    await Promise.all(promises);
  },

  async fetchQuizManifest(forceRefresh = false) {
    if (!forceRefresh && cache.quizManifest) return cache.quizManifest;
    const data = await fetchWithCache(
      'quiz_manifest',
      async () => {
        const docRef = doc(db, 'quiz_metadata', 'quiz_manifest');
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? snapshot.data() : null;
      },
      86400000,
      forceRefresh,
    );
    if (data) cache.quizManifest = data;
    return data;
  },

  async fetchPracticeManifest(forceRefresh = false) {
    if (!forceRefresh && cache.practiceManifest) return cache.practiceManifest;
    const data = await fetchWithCache(
      'practice_manifest',
      async () => {
        const docRef = doc(db, 'quiz_metadata', 'practice_manifest');
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? snapshot.data() : null;
      },
      86400000,
      forceRefresh,
    );
    if (data) cache.practiceManifest = data;
    return data;
  },

  async fetchGeminiKey() {
    if (cache.geminiKey) return cache.geminiKey;
    const data = await fetchWithCache(
      'gemini_api_key',
      async () => {
        const docRef = doc(db, 'app_config', 'keys');
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? snapshot.data().gemini_api_key : null;
      },
      86400000,
    );
    if (data) cache.geminiKey = data;
    return data;
  },

  async fetchQuizQuestions(chapterId) {
    if (cache.quizzes[chapterId]) return cache.quizzes[chapterId];
    const cacheKey = `quiz_questions_${chapterId}`;
    const cachedEntry = await IDB.get(cacheKey);
    if (cachedEntry) {
      const age = Date.now() - cachedEntry.timestamp;
      if (age < 86400000) {
        cache.quizzes[chapterId] = cachedEntry.data;
        return cachedEntry.data;
      }
    }

    const docRef = doc(db, 'quizzes', chapterId);
    const snapshot = await Promise.race([
      getDoc(docRef),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out loading quiz: quizzes/${chapterId}`)), 15000),
      ),
    ]);
    if (!snapshot.exists()) {
      throw new Error(`Quiz document not found: quizzes/${chapterId}`);
    }
    const questions = snapshot.data().questions;
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error(`Quiz has no questions: quizzes/${chapterId}`);
    }

    await IDB.set(cacheKey, { data: questions, timestamp: Date.now() });
    cache.quizzes[chapterId] = questions;
    return questions;
  },

  async fetchPracticeQuestions(docId) {
    if (cache.practice[docId]) return cache.practice[docId];
    const data = await fetchWithCache(
      `practice_questions_${docId}`,
      async () => {
        const docRef = doc(db, 'practice_mcqs', docId);
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? snapshot.data().questions || [] : [];
      },
      86400000,
    );
    if (data) cache.practice[docId] = data;
    return data || [];
  },

  async fetchGlobalStats(chapterId, forceRefresh = false) {
    if (!forceRefresh && cache.globalStats[chapterId]) return cache.globalStats[chapterId];
    const data = await fetchWithCache(
      `global_stats_${chapterId}`,
      async () => {
        const docRef = doc(db, 'chapter_stats', chapterId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;
        const d = snapshot.data();
        return {
          avg: d.average || 0,
          highest: d.highestScore || 0,
          totalAttempts: d.totalAttempts || 0,
          allScores: d.allScores || [],
          leaderboard: d.leaderboard || [],
          correctCounts: d.correctCounts || [],
          attemptedCounts: d.attemptedCounts || [],
        };
      },
      3600000,
      forceRefresh,
    );
    if (data) cache.globalStats[chapterId] = data;
    return data;
  },

  async syncUserHistory(userId, forceRefresh = false) {
    const cacheKey = `user_history_${userId}`;
    let cachedData = null;

    if (!forceRefresh) {
      const entry = await IDB.get(cacheKey);
      if (entry) cachedData = entry.data;
    }

    let lastTimestamp = null;
    if (cachedData && cachedData.length > 0) {
      const maxDate = cachedData.reduce((max, item) => {
        let current = null;
        if (item.timestamp) {
          if (item.timestamp.seconds) current = new Date(item.timestamp.seconds * 1000);
          else if (item.timestamp instanceof Date) current = item.timestamp;
          else if (typeof item.timestamp === 'string') current = new Date(item.timestamp);
        }
        return current && (!max || current > max) ? current : max;
      }, null);
      if (maxDate) lastTimestamp = maxDate;
    }

    let q = query(
      collection(db, 'results'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
    );
    if (lastTimestamp) q = query(q, endBefore(lastTimestamp));

    try {
      const snapshot = await getDocs(q);
      const newDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (newDocs.length === 0) return cachedData || [];

      const combined = [...newDocs, ...(cachedData || [])];
      const unique = [];
      const ids = new Set();
      for (const item of combined) {
        if (!ids.has(item.id)) {
          unique.push(item);
          ids.add(item.id);
        }
      }
      await IDB.set(cacheKey, { data: unique, timestamp: Date.now() });
      return unique;
    } catch (e) {
      console.error('History Sync Error:', e);
      throw e;
    }
  },

  async syncPracticeHistory(userId, forceRefresh = false) {
    const cacheKey = `user_practice_history_${userId}`;
    let cachedData = null;

    if (!forceRefresh) {
      const entry = await IDB.get(cacheKey);
      if (entry) cachedData = entry.data;
    }

    let lastTimestamp = null;
    if (cachedData && cachedData.length > 0) {
      const maxDate = cachedData.reduce((max, item) => {
        let current = null;
        if (item.timestamp) {
          if (item.timestamp.seconds) current = new Date(item.timestamp.seconds * 1000);
          else if (item.timestamp instanceof Date) current = item.timestamp;
          else if (typeof item.timestamp === 'string') current = new Date(item.timestamp);
        }
        return current && (!max || current > max) ? current : max;
      }, null);
      if (maxDate) lastTimestamp = maxDate;
    }

    let q = query(
      collection(db, 'practiceResult'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
    );
    if (lastTimestamp) q = query(q, endBefore(lastTimestamp));

    try {
      const snapshot = await getDocs(q);
      const newDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (newDocs.length === 0) return cachedData || [];

      const combined = [...newDocs, ...(cachedData || [])];
      const unique = [];
      const ids = new Set();
      for (const item of combined) {
        if (!ids.has(item.id)) {
          unique.push(item);
          ids.add(item.id);
        }
      }
      await IDB.set(cacheKey, { data: unique, timestamp: Date.now() });
      return unique;
    } catch (e) {
      console.error('Practice History Sync Error:', e);
      throw e;
    }
  },
};
