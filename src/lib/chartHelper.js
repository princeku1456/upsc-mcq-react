/* =========================================
   3. CHART HELPER (ported verbatim from utils.js)
   ========================================= */
import Chart from "chart.js/auto";
export { Chart };

export const ChartHelper = {
    renderConfidenceChart(ctx, values, stats) {
        if (!ctx) return null;

        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const textColor = isDark ? "#e5e7eb" : "#666";

        return new Chart(ctx, {
            type: "bar",
            data: {
                labels: ["100% Confidence", "75% Confidence", "50% Confidence", "0% Confidence"],
                datasets: [{
                    label: "Accuracy %",
                    data: values,
                    backgroundColor: ["#10b981", "#6366f1", "#f59e0b", "#ef4444"],
                    borderRadius: 5,
                    borderWidth: 1,
                    barThickness: 35
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const idx = context.dataIndex;
                                const confKey = [100, 75, 50, 0][idx];
                                const s = stats[confKey];
                                return [
                                    ` Accuracy: ${context.raw}%`,
                                    ` Total Attempted: ${s.total}`,
                                    ` Total Correct: ${s.correct}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: textColor,
                            callback: (val) => val + "%"
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: textColor }
                    }
                }
            }
        });
    },

    renderPerformanceChart(ctx, data) {
        if (!ctx) return null;

        const chartData = [...data].reverse();
        const labels = chartData.map((item) => {
            if (item.timestamp && item.timestamp.toDate) {
                return new Date(item.timestamp.toDate()).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                });
            } else if (item.timestamp && typeof item.timestamp === 'string') {
                 // Handle string timestamp from cache
                 return new Date(item.timestamp).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                });
            } else if (item.timestamp && item.timestamp.seconds) {
                 return new Date(item.timestamp.seconds * 1000).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                });
            }
            return "Recently";
        });
        const scores = chartData.map((item) => item.scorePercent);
        const subjects = chartData.map((item) => item.subject);
        const chapters = chartData.map((item) => item.chapterName);

        const canvasContext = ctx.getContext("2d");
        const gradientFill = canvasContext.createLinearGradient(0, 0, 0, 400);
        gradientFill.addColorStop(0, "rgba(37, 99, 235, 0.4)");
        gradientFill.addColorStop(1, "rgba(37, 99, 235, 0.0)");

        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const textColor = isDark ? "#9ca3af" : "#6b7280";
        const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
        const tooltipBg = isDark ? "rgba(30, 41, 59, 0.95)" : "rgba(255, 255, 255, 0.95)";
        const tooltipText = isDark ? "#f3f4f6" : "#1f2937";
        const tooltipBorder = isDark ? "#334155" : "#e5e7eb";

        return new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "Accuracy",
                    data: scores,
                    borderColor: "#2563eb",
                    borderWidth: 3,
                    backgroundColor: gradientFill,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: "#ffffff",
                    pointBorderColor: "#2563eb",
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointHoverBackgroundColor: "#f59e0b",
                    pointHoverBorderColor: "#ffffff",
                    pointHoverBorderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: "index" },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipText,
                        bodyColor: tooltipText,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        titleFont: { size: 13, weight: "bold" },
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: (tooltipItems) => subjects[tooltipItems[0].dataIndex],
                            label: (context) => [
                                `📖 ${chapters[context.dataIndex]}`,
                                `📅 ${labels[context.dataIndex]}`,
                                `🎯 Score: ${context.raw}%`,
                            ],
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: textColor,
                            font: { size: 11 },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 6,
                        },
                    },
                    y: {
                        beginAtZero: true,
                        max: 110,
                        grid: { color: gridColor, borderDash: [5, 5] },
                        ticks: {
                            color: textColor,
                            font: { size: 11 },
                            stepSize: 20,
                            callback: (value) => value + "%",
                        },
                    },
                },
            },
        });
    }
};
