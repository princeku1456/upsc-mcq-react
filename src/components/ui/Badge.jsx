import React, { memo } from "react";

const Badge = memo(function Badge({ variant = "pen", className = "", children }) {
  return (
    <span className={`badge badge--${variant} ${className}`}>
      {children}
    </span>
  );
});

export default Badge;
