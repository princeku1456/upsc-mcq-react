import React, { useEffect, useRef } from "react";
import { ChartHelper } from "../../lib/chartHelper";
import { calculateConfidenceStats } from "../../lib/helpers";

export default function DashboardCharts({ chartData, loaded, theme }) {
  const perfChartRef = useRef(null);
  const confChartRef = useRef(null);
  const perfInstance = useRef(null);
  const confInstance = useRef(null);

  useEffect(() => {
    const { confValues, confStats } = calculateConfidenceStats(chartData);

    if (perfInstance.current) { perfInstance.current.destroy(); perfInstance.current = null; }
    if (perfChartRef.current) {
      perfInstance.current = ChartHelper.renderPerformanceChart(perfChartRef.current, chartData);
    }

    if (confInstance.current) { confInstance.current.destroy(); confInstance.current = null; }
    if (confChartRef.current) {
      confInstance.current = ChartHelper.renderConfidenceChart(confChartRef.current, confValues, confStats);
    }

    return () => {
      if (perfInstance.current) { perfInstance.current.destroy(); perfInstance.current = null; }
      if (confInstance.current) { confInstance.current.destroy(); confInstance.current = null; }
    };
  }, [loaded, theme]);

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
