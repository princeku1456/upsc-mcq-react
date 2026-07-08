import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../store";

/* =========================================
   GLOBAL LOADER (premium loader from index.html)
   ========================================= */
export function GlobalLoader() {
  const { globalLoaderVisible } = useApp();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!globalLoaderVisible) {
      // Same behaviour as hideGlobalLoader(): fade then remove after 500ms
      const t = setTimeout(() => setGone(true), 500);
      return () => clearTimeout(t);
    }
  }, [globalLoaderVisible]);

  if (gone) return null;

  return (
    <div
      id="global-loader"
      className={`global-loader ${!globalLoaderVisible ? "loader-hidden" : ""}`}
    >
      <div className="loader-wrapper">
        <div className="premium-loader">
          <div className="ring"></div>
          <div className="ring"></div>
          <div className="ring"></div>
          <span className="loader-icon">✨</span>
        </div>
        <div className="loader-text-container">
          <h5 className="loader-title">MCQ Practice</h5>
          <div className="loader-status">
            <span className="dot-pulse"></span>
            Initializing secure session
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   NAVBAR (theme toggle + user dropdown)
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
    <nav className="navbar navbar-expand-lg navbar-dark main-navbar sticky-top">
      <div className="container">
        <a
          className="navbar-brand fw-bold"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleLogoClick();
          }}
        >
          ✨ MCQ Practice
        </a>
        <div className="d-flex align-items-center gap-3">
          <button
            className="btn btn-outline-light btn-sm rounded-circle d-flex align-items-center justify-content-center theme-toggle-btn"
            id="theme-toggle"
            onClick={toggleTheme}
            style={{ width: 38, height: 38, fontSize: "1.2rem" }}
            title="Toggle Theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {currentUser && (
            <div className="dropdown" id="user-profile" ref={dropdownRef}>
              <button
                className="btn btn-link text-white text-decoration-none dropdown-toggle fw-bold"
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
              >
                <span id="user-name-display">{userName}</span>
              </button>
              <ul
                className={`dropdown-menu dropdown-menu-end shadow ${
                  dropdownOpen ? "show" : ""
                }`}
                style={dropdownOpen ? { position: "absolute", right: 0 } : {}}
              >
                <li>
                  <a
                    className="dropdown-item"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setDropdownOpen(false);
                      showDashboard();
                    }}
                  >
                    📊 Dashboard
                  </a>
                </li>
                <li>
                  <hr className="dropdown-divider" />
                </li>
                <li>
                  <a
                    className="dropdown-item text-danger"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setDropdownOpen(false);
                      logoutUser();
                    }}
                  >
                    🚪 Logout
                  </a>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
