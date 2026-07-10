import React, { memo, useCallback } from "react";
import { CONFIDENCE_LEVELS } from "../../config/constants";

const ConfidenceBar = memo(function ConfidenceBar({ value, onChange, disabled }) {
  const handleClick = useCallback((e) => {
    onChange(Number(e.currentTarget.dataset.level));
  }, [onChange]);

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
            onClick={handleClick}
          >
            {level}% Confidence
          </button>
        ))}
      </div>
    </div>
  );
});

export default ConfidenceBar;
