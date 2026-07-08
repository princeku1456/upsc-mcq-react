/* =========================================
   1. DATA MANAGER (ported verbatim from utils.js)
   ========================================= */
import { IDB } from "./idb";
import { getDb } from "./firebase";

export const DataManager = {
    cache: {
        quizManifest: null,
        practiceManifest: null,
        quizzes: {},     // Cache for specific quiz/chapter data
        practice: {},
        geminiKey: null,     // Cache for practice questions
        globalStats: {} // NEW: In-memory cache for global stats
    },

    /**
     * Generic caching wrapper
     * @param {string} key - Cache key
     * @param {function} fetcher - Async function to fetch data if cache is miss
     * @param {number} ttl - Time to live in ms (default 24h)
     * @param {boolean} forceRefresh - Ignore cache
     */
    async fetchWithCache(key, fetcher, ttl = 86400000, forceRefresh = false) {
        if (!forceRefresh) {
            const cachedEntry = await IDB.get(key);
            if (cachedEntry) {
                const age = Date.now() - cachedEntry.timestamp;
                if (age < ttl) {
                    return cachedEntry.data;
                }
            }
        }

        try {
            const data = await fetcher();
            if (data !== null && data !== undefined) {
                await IDB.set(key, {
                    data: data,
                    timestamp: Date.now()
                });
                return data;
            }
        } catch (error) {
            console.error(`Error fetching data for ${key}:`, error);
        }
        return null;
    },

    /**
     * Clears a specific cache entry
     */
    async invalidateCache(key) {
        await IDB.delete(key);
    },

    /**
     * Clears all cache entries starting with a prefix
     */
    async invalidateCacheByPrefix(prefix) {
        const keys = await IDB.getAllKeys();
        const promises = [];
        keys.forEach(key => {
            if (typeof key === 'string' && key.startsWith(prefix)) {
                promises.push(IDB.delete(key));
            }
        });
        await Promise.all(promises);
    },

    /**
     * Fetches the quiz manifest (Subjects & Chapters)
     */
    async fetchQuizManifest(forceRefresh = false) {
        // Check memory cache first
        if (!forceRefresh && this.cache.quizManifest) {
            return this.cache.quizManifest;
        }

        const data = await this.fetchWithCache(
            "quiz_manifest",
            async () => {
                const doc = await getDb().collection("quiz_metadata").doc("quiz_manifest").get();
                return doc.exists ? doc.data() : null;
            },
            86400000, // 24 hours
            forceRefresh
        );

        if (data) {
            this.cache.quizManifest = data;
            // Maintain backward compatibility
            window.allQuizData = data;
        }
        return data;
    },

    async fetchGeminiKey() {
        if (this.cache.geminiKey) return this.cache.geminiKey;

        const data = await this.fetchWithCache(
            "gemini_api_key",
            async () => {
                const doc = await getDb().collection("app_config").doc("keys").get();
                return doc.exists ? doc.data().gemini_api_key : null;
            },
            86400000 // 24 hours
        );

        if (data) {
            this.cache.geminiKey = data;
        }
        return data;
    },

    /**
     * Fetches the practice manifest
     */
    async fetchPracticeManifest(forceRefresh = false) {
        if (!forceRefresh && this.cache.practiceManifest) {
            return this.cache.practiceManifest;
        }

        const data = await this.fetchWithCache(
            "practice_manifest",
            async () => {
                const doc = await getDb().collection("quiz_metadata").doc("practice_manifest").get();
                return doc.exists ? doc.data() : null;
            },
            86400000, // 24 hours
            forceRefresh
        );

        if (data) {
            this.cache.practiceManifest = data;
            window.allPracticeData = data;
        }
        return data;
    },

    /**
     * Fetches questions for a specific chapter
     */
    async fetchQuizQuestions(chapterId) {
        if (this.cache.quizzes[chapterId]) {
            return this.cache.quizzes[chapterId];
        }

        const data = await this.fetchWithCache(
            `quiz_questions_${chapterId}`,
            async () => {
                const doc = await getDb().collection("quizzes").doc(chapterId).get();
                return doc.exists ? doc.data().questions : null;
            },
            86400000 // 24 hours
        );

        if (data) {
            this.cache.quizzes[chapterId] = data;
        }
        return data;
    },

    /**
     * Fetches practice questions
     */
    async fetchPracticeQuestions(docId) {
        if (this.cache.practice[docId]) {
            return this.cache.practice[docId];
        }

        const data = await this.fetchWithCache(
            `practice_questions_${docId}`,
            async () => {
                const doc = await getDb().collection("practice_mcqs").doc(docId).get();
                return doc.exists ? (doc.data().questions || []) : [];
            },
            86400000 // 24 hours
        );

        if (data) {
            this.cache.practice[docId] = data;
        }
        return data || [];
    },

    /**
     * Fetches global stats for a chapter (NEW)
     */
    async fetchGlobalStats(chapterId, forceRefresh = false) {
        if (!forceRefresh && this.cache.globalStats[chapterId]) {
            return this.cache.globalStats[chapterId];
        }

        const data = await this.fetchWithCache(
            `global_stats_${chapterId}`,
            async () => {
                const doc = await getDb().collection("chapter_stats").doc(chapterId).get();
                if (!doc.exists) return null;
                const d = doc.data();
                return {
                    avg: d.average || 0,
                    highest: d.highestScore || 0,
                    totalAttempts: d.totalAttempts || 0,
                    allScores: d.allScores || [],
                    leaderboard: d.leaderboard || [],
                    correctCounts: d.correctCounts || [],
                    attemptedCounts: d.attemptedCounts || []
                };
            },
            3600000, // 1 hour TTL
            forceRefresh
        );

        if (data) {
            this.cache.globalStats[chapterId] = data;
        }
        return data;
    },

    /**
     * Syncs user history incrementally
     */
    async syncUserHistory(userId, forceRefresh = false) {
        const cacheKey = `user_history_${userId}`;
        let cachedData = null;

        // 1. Try to load from IDB
        if (!forceRefresh) {
            const entry = await IDB.get(cacheKey);
            if (entry) {
                cachedData = entry.data; // This is the array of history items
            }
        }

        // 2. Determine latest timestamp
        let lastTimestamp = null;
        if (cachedData && cachedData.length > 0) {
            // Use 'reduce' to safely find the max timestamp, in case IDB order isn't guaranteed
            const maxDate = cachedData.reduce((max, item) => {
                let current = null;
                if (item.timestamp) {
                    if (item.timestamp.seconds) {
                         current = new Date(item.timestamp.seconds * 1000);
                    } else if (typeof item.timestamp === 'string') {
                         current = new Date(item.timestamp);
                    }
                }
                return (current && (!max || current > max)) ? current : max;
            }, null);

            if (maxDate) {
                lastTimestamp = maxDate;
            }
        }

        console.log("Last Sync Timestamp:", lastTimestamp);

        // 3. Query Firestore
        let query = getDb().collection("results")
            .where("userId", "==", userId)
            .orderBy("timestamp", "desc");

        if (lastTimestamp) {
            // "endBefore" with DESC sort fetches items NEWER than the cursor
            query = query.endBefore(lastTimestamp);
        }

        try {
            const snapshot = await query.get();
            console.log("Firestore Snapshot Size:", snapshot.size);

            // 4. Merge Data
            const newDocs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (newDocs.length === 0) {
                console.log("No new history to sync.");
                return cachedData || [];
            }

            console.log(`Synced ${newDocs.length} new records.`);

            // Deduplicate based on ID (safety against timestamp precision issues)
            const combined = [...newDocs, ...(cachedData || [])];
            const unique = [];
            const ids = new Set();
            for (const item of combined) {
                if (!ids.has(item.id)) {
                    unique.push(item);
                    ids.add(item.id);
                }
            }

            // 5. Update Cache
            await IDB.set(cacheKey, {
                data: unique,
                timestamp: Date.now()
            });

            return unique;

        } catch (e) {
            console.error("History Sync Error:", e);
            return cachedData || [];
        }
    },

    /**
     * Syncs practice history incrementally
     */
    async syncPracticeHistory(userId, forceRefresh = false) {
        const cacheKey = `user_practice_history_${userId}`;
        let cachedData = null;

        // 1. Try to load from IDB
        if (!forceRefresh) {
            const entry = await IDB.get(cacheKey);
            if (entry) {
                cachedData = entry.data;
            }
        }

        // 2. Determine latest timestamp
        let lastTimestamp = null;
        if (cachedData && cachedData.length > 0) {
            const maxDate = cachedData.reduce((max, item) => {
                let current = null;
                if (item.timestamp) {
                    if (item.timestamp.seconds) {
                         current = new Date(item.timestamp.seconds * 1000);
                    } else if (typeof item.timestamp === 'string') {
                         current = new Date(item.timestamp);
                    }
                }
                return (current && (!max || current > max)) ? current : max;
            }, null);

            if (maxDate) {
                lastTimestamp = maxDate;
            }
        }

        console.log("Last Practice Sync Timestamp:", lastTimestamp);

        // 3. Query Firestore
        let query = getDb().collection("practiceResult")
            .where("userId", "==", userId)
            .orderBy("timestamp", "desc");

        if (lastTimestamp) {
            query = query.endBefore(lastTimestamp);
        }

        try {
            const snapshot = await query.get();
            console.log("Firestore Practice Snapshot Size:", snapshot.size);

            // 4. Merge Data
            const newDocs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (newDocs.length === 0) {
                console.log("No new practice history to sync.");
                return cachedData || [];
            }

            console.log(`Synced ${newDocs.length} new practice records.`);

            // Deduplicate
            const combined = [...newDocs, ...(cachedData || [])];
            const unique = [];
            const ids = new Set();
            for (const item of combined) {
                if (!ids.has(item.id)) {
                    unique.push(item);
                    ids.add(item.id);
                }
            }

            // 5. Update Cache
            await IDB.set(cacheKey, {
                data: unique,
                timestamp: Date.now()
            });

            return unique;

        } catch (e) {
            console.error("Practice History Sync Error:", e);
            return cachedData || [];
        }
    }
};
