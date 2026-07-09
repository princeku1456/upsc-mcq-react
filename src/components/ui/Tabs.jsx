import React from "react";

export default function Tabs({ options, active, onChange }) {
  return (
    <div className="tabs">
      {options.map((opt) => (
        <button
          key={opt.id}
          className={`tabs__tab ${active === opt.id ? "tabs__tab--active" : ""}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
