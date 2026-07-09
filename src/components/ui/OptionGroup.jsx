import React from "react";
import { LABEL_MAP } from "../../config/constants";

export default function OptionGroup({ options, correctIndex, selectedIndex, disabled, submitted, onSelect }) {
  return (
    <div className="grid">
      {options.map((opt, idx) => {
        const isSelected = selectedIndex === idx;
        let optionClass = "option";
        let omrClass = "omr";

        if (submitted) {
          if (idx === correctIndex) {
            optionClass += " option--correct";
            omrClass += " omr--correct";
          } else if (isSelected && idx !== correctIndex) {
            optionClass += " option--wrong";
            omrClass += " omr--wrong";
          }
        } else if (isSelected) {
          optionClass += " option--selected";
          omrClass += " omr--filled";
        }

        return (
          <button
            key={idx}
            className={optionClass}
            disabled={disabled || submitted}
            onClick={() => onSelect(idx)}
          >
            <div className={omrClass}>{LABEL_MAP[idx]}</div>
            <div className="option__text" dangerouslySetInnerHTML={{ __html: opt }} />
          </button>
        );
      })}
    </div>
  );
}
