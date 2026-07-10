import React, { memo } from "react";

const PageShell = memo(function PageShell({ heroTitle, heroSubtitle, children }) {
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
});

export default PageShell;
