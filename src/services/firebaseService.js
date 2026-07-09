import { db, getDb } from "../lib/firebase";
import { getCorrectIndex } from "../lib/helpers";
import { LEADERBOARD_LIMIT, SCORING } from "../config/constants";

export const firebaseService = {
  async fetchQuizManifest() {
    const doc = await getDb().collection("quiz_metadata").doc("quiz_manifest").get();
    return doc.exists ? doc.data() : null;
  },

  async fetchQuizQuestions(chapterId) {
    const doc = await getDb().collection("quizzes").doc(chapterId).get();
    return doc.exists ? doc.data().questions : null;
  },

  async fetchGlobalStats(chapterId) {
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
      attemptedCounts: d.attemptedCounts || [],
    };
  },

  async fetchGeminiKey() {
    const doc = await getDb().collection("app_config").doc("keys").get();
    return doc.exists ? doc.data().gemini_api_key : null;
  },

  async fetchUserHistory(userId, lastTimestamp) {
    let query = getDb()
      .collection("results")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc");

    if (lastTimestamp) {
      query = query.endBefore(lastTimestamp);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async submitResult(resultObject) {
    const docRef = await db.collection("results").add({ ...resultObject });
    return docRef.id;
  },

  buildLeaderboardEntry(currentUser, percentage, finalScore) {
    return {
      userEmail: currentUser ? currentUser.email : "guest",
      scorePercent: parseFloat(percentage),
      score: finalScore,
      rankTime: new Date().toISOString(),
    };
  },

  buildResultObject(currentUser, subject, chapterId, chapterName, score, totalMarks, scorePercent, userAnswers, questionTimeSpent) {
    return {
      userId: currentUser ? currentUser.uid : "guest",
      userEmail: currentUser ? currentUser.email : "guest",
      subject,
      chapterId,
      chapterName,
      score: parseFloat(score.toFixed(2)),
      totalMarks,
      scorePercent: parseFloat(scorePercent),
      userAnswers,
      questionTimeSpent,
      timestamp: new Date(),
    };
  },

  async updateChapterStats(chapterId, scorePercent, leaderboardEntry, quizData, userAnswers) {
    const statsRef = getDb().collection("chapter_stats").doc(chapterId);
    const newScore = parseFloat(scorePercent);

    await getDb().runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(statsRef);

      if (!sfDoc.exists) {
        const initCorrectCounts = quizData.map((q, i) =>
          userAnswers[i] && userAnswers[i].answer === getCorrectIndex(q) ? 1 : 0
        );
        const initAttemptedCounts = quizData.map((q, i) =>
          userAnswers[i] ? 1 : 0
        );
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
        if (currentLeaderboard.length > LEADERBOARD_LIMIT) {
          currentLeaderboard = currentLeaderboard.slice(0, LEADERBOARD_LIMIT);
        }

        let cCounts = [...(data.correctCounts || [])];
        let aCounts = [...(data.attemptedCounts || [])];
        const maxLen = Math.max(cCounts.length, aCounts.length, quizData.length);
        for (let j = 0; j < maxLen; j++) {
          if (cCounts[j] == null) cCounts[j] = 0;
          if (aCounts[j] == null) aCounts[j] = 0;
        }

        quizData.forEach((q, i) => {
          if (userAnswers[i]) {
            aCounts[i] = (aCounts[i] || 0) + 1;
            if (userAnswers[i].answer === getCorrectIndex(q)) {
              cCounts[i] = (cCounts[i] || 0) + 1;
            }
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
  },

  async fetchResultsByUser(email) {
    const snapshot = await getDb()
      .collection("results")
      .where("userEmail", "==", email.toLowerCase())
      .orderBy("timestamp", "desc")
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const date = data.timestamp
        ? new Date(data.timestamp.toDate()).toLocaleDateString()
        : "N/A";
      return { id: doc.id, ...data, date };
    });
  },

  async fetchResultsByChapter(chapterId, limit = 100) {
    const snapshot = await getDb()
      .collection("results")
      .where("chapterId", "==", chapterId)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  },

  async fetchAllUserEmails() {
    const snapshot = await getDb().collection("results").get();
    const emails = new Set();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.userEmail && data.userEmail !== "guest") {
        emails.add(data.userEmail.toLowerCase());
      }
    });
    return Array.from(emails).sort();
  },

  async checkAdminAccess(uid) {
    const doc = await db.collection("admins").doc(uid).get();
    return doc.exists;
  },

  async deleteAttempt(docId, chapterId, data) {
    const resultRef = getDb().collection("results").doc(docId);
    const resultSnap = await resultRef.get();
    if (!resultSnap.exists) return false;

    const d = resultSnap.data();
    const scorePercent = d.scorePercent;
    const userAnswers = d.userAnswers || {};
    const statsRef = getDb().collection("chapter_stats").doc(chapterId);

    await getDb().runTransaction(async (transaction) => {
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
          if (entry.resultId && entry.resultId === docId) return false;
          if (entry.userEmail === d.userEmail) {
            const scoreMatch = Math.abs(entry.scorePercent - scorePercent) < 0.1;
            const entryTime = new Date(entry.rankTime).getTime();
            const dataTime = d.timestamp ? d.timestamp.toDate().getTime() : 0;
            const timeMatch = Math.abs(entryTime - dataTime) < 5000;
            if (scoreMatch && timeMatch) return false;
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

    return true;
  },

  async fetchResultWithQuestions(docId, chapterId) {
    const [resultSnap, questions] = await Promise.all([
      getDb().collection("results").doc(docId).get(),
      getDb().collection("quizzes").doc(chapterId).get(),
    ]);

    if (!resultSnap.exists) throw new Error("Result record not found.");
    if (!questions.exists) throw new Error("Quiz questions not found.");

    return {
      resultData: resultSnap.data(),
      questions: questions.data().questions,
    };
  },
};
