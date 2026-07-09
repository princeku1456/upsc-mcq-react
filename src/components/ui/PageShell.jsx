import React from "react";

export default function PageShell({ heroTitle, heroSubtitle, children }) {
  return (
    <div className="page">
      {(heroTitle || heroSubtitle) && (
        <div className="dash__hero">
          {heroTitle && <h1>{heroTitle}</h1>}
          {heroSubtitle && <p>{heroSubtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
