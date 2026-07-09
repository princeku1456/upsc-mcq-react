import React from "react";

export default function Badge({ variant = "pen", className = "", children }) {
  return (
    <span className={`badge badge--${variant} ${className}`}>
      {children}
    </span>
  );
}
