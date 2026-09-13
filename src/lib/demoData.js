export const DEMO_DATA = {
  'quiz_metadata/quiz_manifest': {
    'History': { 'Ancient_India': 'Test-1', 'Medieval_India': 'Test-2' },
    'Geography': { 'Physical_Geography': 'Test-1' }
  },
  'quizzes/History_Ancient_India': {
    questions: [
      { text: 'Who built the Red Fort?', options: ['Shah Jahan', 'Akbar', 'Aurangzeb', 'Jahangir'], correctAnswer: 0, explanation: 'Shah Jahan built it.' },
      { text: 'What is the capital of India?', options: ['Mumbai', 'Delhi', 'Kolkata', 'Chennai'], correctAnswer: 1, explanation: 'New Delhi is the capital of India.' }
    ]
  },
  'quizzes/History_Medieval_India': {
    questions: [
      { text: 'Who founded the Mughal Empire?', options: ['Babur', 'Humayun', 'Akbar', 'Sher Shah Suri'], correctAnswer: 0, explanation: 'Babur founded the Mughal Empire after the First Battle of Panipat in 1526.' }
    ]
  },
  'quizzes/Geography_Physical_Geography': {
    questions: [
      { text: 'Which is the longest river in the world?', options: ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], correctAnswer: 1, explanation: 'The Nile is traditionally considered the longest river in the world.' }
    ]
  },
  'quiz_metadata/practice_manifest': {
    'History': { 'Ancient_India': 'Test-1' }
  },
  'practice_mcqs/History_Ancient_India': {
    questions: [
      { text: 'Practice Q1', options: ['A', 'B', 'C', 'D'], correctAnswer: 0, explanation: 'Exp 1' },
      { text: 'Practice Q2', options: ['A', 'B', 'C', 'D'], correctAnswer: 1, explanation: 'Exp 2' }
    ]
  },
  'chapter_stats/History_Ancient_India': {
    average: 60, highestScore: 100, totalAttempts: 5, allScores: [50, 60, 70, 80, 40], leaderboard: []
  },
  'chapter_stats/History_Medieval_India': {
    average: 50, highestScore: 100, totalAttempts: 1, allScores: [50], leaderboard: []
  },
  'chapter_stats/Geography_Physical_Geography': {
    average: 50, highestScore: 100, totalAttempts: 1, allScores: [50], leaderboard: []
  }
};
