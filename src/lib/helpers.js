/* =========================================
   SHARED HELPERS + TEXT FORMATTER + DIFFICULTY HELPER
   Ported verbatim from utils.js
   ========================================= */

export function getCorrectIndex(question) {
  if (typeof question.correctAnswer === "number") return question.correctAnswer;
  const optionIndex = question.options.indexOf(question.correctAnswer);
  if (optionIndex !== -1) return optionIndex;
  if (!isNaN(question.correctAnswer)) return Number(question.correctAnswer);
  return -1;
}

/**
 * Calculates confidence statistics from user history results.
 * @param {Array} results - The user history array.
 * @returns {Object} { confValues, confStats }
 */
export function calculateConfidenceStats(results) {
  // Initialize Global Confidence Trackers
  const confStats = {
    100: { total: 0, correct: 0 },
    75: { total: 0, correct: 0 },
    50: { total: 0, correct: 0 },
    0: { total: 0, correct: 0 }
  };

  // Aggregate data from all tests
  results.forEach(res => {
    if (res.userAnswers) {
      Object.values(res.userAnswers).forEach(ans => {
        // Aggregate Confidence Data for charts
        if (ans.surety !== undefined) {
          confStats[ans.surety].total++;
          if (ans.isCorrect) confStats[ans.surety].correct++;
        }
      });
    }
  });

  // Prepare Confidence Data for Charting
  const confValues = [
    confStats[100].total > 0 ? (confStats[100].correct / confStats[100].total * 100).toFixed(1) : 0,
    confStats[75].total > 0 ? (confStats[75].correct / confStats[75].total * 100).toFixed(1) : 0,
    confStats[50].total > 0 ? (confStats[50].correct / confStats[50].total * 100).toFixed(1) : 0,
    confStats[0].total > 0 ? (confStats[0].correct / confStats[0].total * 100).toFixed(1) : 0
  ];

  return { confValues, confStats };
}

/* =========================================
   TEXT FORMATTER (verbatim)
   ========================================= */
export const TextFormatter = {
    formatQuestionText(text) {
        if (!text) return "";

        // Split by newline to process line by line, handling various line endings
        const lines = text.split(/\r?\n/);
        let output = [];
        let inTable = false;
        let tableLines = [];
        let currentSeparator = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detect separator
            let separator = null;
            if (line.includes('|')) separator = '|';
            else if (line.includes(' - ') && !line.trim().startsWith('-')) separator = ' - ';

            // If we are already in a table
            if (inTable) {
                // Check if the current line continues the table (must have same separator)
                if (separator === currentSeparator) {
                     tableLines.push(line);
                } else {
                     // End of table
                     output.push(this.renderTable(tableLines, currentSeparator));
                     inTable = false;
                     tableLines = [];

                     // Check if this line starts a NEW table
                     if (separator) {
                         inTable = true;
                         currentSeparator = separator;
                         tableLines.push(line);
                     } else {
                         output.push(line);
                     }
                }
            } else {
                // Not in table, check if we should start one
                if (separator) {
                    inTable = true;
                    currentSeparator = separator;
                    tableLines.push(line);
                } else {
                    output.push(line);
                }
            }
        }

        // Handle case where table is at the end
        if (inTable) {
            output.push(this.renderTable(tableLines, currentSeparator));
        }

        return output.join('<br>');
    },

    renderTable(lines, separator = '|') {
        if (lines.length === 0) return "";

        let html = '<div class="table-responsive my-3"><table class="table table-bordered table-sm table-hover align-middle mb-0"><thead>';

        // First line is header
        const headers = lines[0].split(separator);
        html += '<tr class="table-light">';
        html += headers.map(h => `<th class="fw-bold text-secondary text-uppercase small" scope="col">${h.trim()}</th>`).join('');
        html += '</tr></thead><tbody>';

        // Remaining lines are body
        for (let i = 1; i < lines.length; i++) {
            const cells = lines[i].split(separator);
            html += `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join('')}</tr>`;
        }

        html += '</tbody></table></div>';
        return html;
    }
};

/* =========================================
   DIFFICULTY HELPER (verbatim)
   ========================================= */
export const DifficultyHelper = {
    /**
     * Calculates difficulty label based on community accuracy.
     * @param {number} correctCount - Number of correct attempts
     * @param {number} totalAttempts - Total number of attempts
     * @returns {Object} { label: "Easy"|"Medium"|"Hard", color: "success"|"warning"|"danger", percentage: number }
     */
    calculate(correctCount, totalAttempts) {
        if (!totalAttempts || totalAttempts <= 0) {
             return { label: "Medium", color: "warning", percentage: 0 };
        }

        const percentage = Math.round((correctCount / totalAttempts) * 100);

        if (percentage >= 70) {
            return { label: "Easy", color: "success", percentage };
        } else if (percentage <= 40) {
            return { label: "Hard", color: "danger", percentage };
        } else {
            return { label: "Medium", color: "warning", percentage };
        }
    }
};
