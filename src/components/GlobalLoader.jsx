import React, { useEffect, useState } from "react";
import { useApp } from "../store";

export function GlobalLoader() {
  const { globalLoaderVisible } = useApp();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!globalLoaderVisible) {
      const t = setTimeout(() => setGone(true), 500);
      return () => clearTimeout(t);
    }
  }, [globalLoaderVisible]);

  if (gone) return null;

  return (
    <div className={`global-loader ${!globalLoaderVisible ? "global-loader--hidden" : ""}`}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div className="spinner spinner--lg"></div>
        <div style={{ textAlign: "center" }}>
          <h4 style={{ margin: "0 0 4px" }}>MCQ Test</h4>
          <span className="eyebrow">Initializing session…</span>
        </div>
      </div>
    </div>
  );
}
