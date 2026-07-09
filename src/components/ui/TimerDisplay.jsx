import React from "react";

export default function TimerDisplay({ text, low, onToggle, isPaused, showControls }) {
  return (
    <>
      <div className={`timer-pill ${low ? "timer-pill--low" : ""}`} style={{ width: "100%", justifyContent: "center", fontSize: 18, padding: "12px 16px", marginBottom: 14 }}>
        ⏳ {text || "00:00"}
      </div>
      {showControls && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn btn--ghost btn--block" onClick={onToggle}>
            {isPaused ? "▶ Resume Timer" : "⏸ Pause Timer"}
          </button>
        </div>
      )}
    </>
  );
}
