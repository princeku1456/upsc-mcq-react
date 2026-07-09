import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../store";

/* =========================================
   GLOBAL LOADER
   ========================================= */
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

/* =========================================
   NAVBAR
   ========================================= */
export function Navbar() {
  const { currentUser, theme, toggleTheme, handleLogoClick, showDashboard, logoutUser } =
    useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const userName =
    currentUser && currentUser.email ? currentUser.email.split("@")[0] : "User";

  return (
    <nav className="nav">
      <button className="nav__brand" onClick={handleLogoClick}>
        <span className="nav__mark">✦</span>
        MCQ Test
      </button>

      <div className="nav__right">
        <button
          className="nav__icon"
          onClick={toggleTheme}
          title="Toggle Theme"
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        {currentUser && (
          <div className="dropdown" ref={dropdownRef}>
            <button
              className="nav__icon"
              style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setDropdownOpen((v) => !v)}
            >
              <span className="nav__user">{userName}</span>
              <span style={{ fontSize: 10 }}>▼</span>
            </button>
            <div className={`dropdown__menu ${dropdownOpen ? "dropdown__menu--open" : ""}`}>
              <button
                className="dropdown__item"
                onClick={() => { setDropdownOpen(false); showDashboard(); }}
              >
                📊 Dashboard
              </button>
              <div className="dropdown__divider"></div>
              <button
                className="dropdown__item dropdown__item--danger"
                onClick={() => { setDropdownOpen(false); logoutUser(); }}
              >
                🚪 Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
