import React from "react";
import { CONFIDENCE_LEVELS } from "../../config/constants";

export default function ConfidenceBar({ value, onChange, disabled }) {
  return (
    <div>
      <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Confidence Level</span>
      <div className="confidence">
        {CONFIDENCE_LEVELS.map((level) => (
          <button
            key={level}
            data-level={level}
            className={`confidence__chip ${value === level ? "confidence__chip--on" : ""}`}
            disabled={disabled}
            onClick={() => onChange(level)}
          >
            {level}% Confidence
          </button>
        ))}
      </div>
    </div>
  );
}
