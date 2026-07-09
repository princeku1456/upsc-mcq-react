import React from "react";

export default function ProgressBar({ value, variant }) {
  const fillCls = variant === "leaf"
    ? "progress__fill--leaf"
    : variant === "marker"
    ? "progress__fill--marker"
    : "";

  return (
    <div className="progress">
      <div
        className={`progress__fill ${fillCls}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      ></div>
    </div>
  );
}
