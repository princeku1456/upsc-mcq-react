import React, { memo, useCallback } from "react";

const Tabs = memo(function Tabs({ options, active, onChange }) {
  const handleClick = useCallback((e) => {
    onChange(e.currentTarget.dataset.id);
  }, [onChange]);

  return (
    <div className="tabs">
      {options.map((opt) => (
        <button
          key={opt.id}
          data-id={opt.id}
          className={`tabs__tab ${active === opt.id ? "tabs__tab--active" : ""}`}
          onClick={handleClick}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
});

export default Tabs;
