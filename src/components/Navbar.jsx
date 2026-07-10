import React, { memo, useCallback, useState } from "react";
import { useApp } from "../store";
import { useClickOutside } from "../hooks/useClickOutside";

export const Navbar = memo(function Navbar() {
  const { currentUser, theme, toggleTheme, handleLogoClick, showDashboard, logoutUser } =
    useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);
  const dropdownRef = useClickOutside(closeDropdown);

  const handleDashboardClick = useCallback(() => {
    setDropdownOpen(false);
    showDashboard();
  }, [showDashboard]);

  const handleLogoutClick = useCallback(() => {
    setDropdownOpen(false);
    logoutUser();
  }, [logoutUser]);

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
                onClick={handleDashboardClick}
              >
                📊 Dashboard
              </button>
              <div className="dropdown__divider"></div>
              <button
                className="dropdown__item dropdown__item--danger"
                onClick={handleLogoutClick}
              >
                🚪 Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
});
