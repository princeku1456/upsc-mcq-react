import React from "react";

export default function Spinner({ size = "md", text }) {
  const cls = size === "lg" ? "spinner spinner--lg" : "spinner";
  return (
    <div className="empty">
      <div className={cls}></div>
      {text && <p style={{ marginTop: 14 }}>{text}</p>}
    </div>
  );
}
