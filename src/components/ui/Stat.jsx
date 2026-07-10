import React, { memo } from "react";

const Stat = memo(function Stat({ variant, label, value, sub }) {
  const vClass = variant ? `stat--${variant}` : "";
  return (
    <div className={`stat ${vClass}`}>
      <span className="eyebrow">{label}</span>
      <span className="stat__value">{value}</span>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  );
});

export default Stat;
