import React from "react";
import { ChartHelper } from "../../lib/chartHelper";
import { calculateConfidenceStats } from "../../lib/helpers";
import { useChart } from "../../hooks/useChart";

export default function DashboardCharts({ chartData, loaded, theme }) {
  const { confValues, confStats } = calculateConfidenceStats(chartData);

  const confChartRef = useChart(
    (canvas) => ChartHelper.renderConfidenceChart(canvas, confValues, confStats),
    [loaded, theme]
  );

  const perfChartRef = useChart(
    (canvas) => ChartHelper.renderPerformanceChart(canvas, chartData),
    [loaded, theme]
  );

  return (
    <div className="charts-grid">
      <div className="card">
        <div className="card__head">
          <h2 className="card__title">🎯 Overall Confidence Analysis</h2>
        </div>
        <div className="chart-wrap">
          <canvas id="globalConfidenceChart" ref={confChartRef}></canvas>
        </div>
      </div>
      <div className="card">
        <div className="card__head">
          <h2 className="card__title">📈 Accuracy Trend</h2>
        </div>
        <div className="chart-wrap">
          <canvas id="performanceChart" ref={perfChartRef}></canvas>
        </div>
      </div>
    </div>
  );
}
