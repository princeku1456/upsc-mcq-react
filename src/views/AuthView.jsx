import React, { useState } from "react";
import { useApp } from "../store";

export default function AuthView() {
  const { isRegistering, toggleAuthMode, submitAuthForm, signInWithGoogle } =
    useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    submitAuthForm(email, password);
    if (isRegistering) setPassword("");
  };

  return (
    <div className="login">
      <div className="card login__card">
        <div className="text-center" style={{ marginBottom: 20 }}>
          <h3>{isRegistering ? "Create Account" : "Welcome Back 👋"}</h3>
          <p style={{ color: "var(--ink-soft)", margin: "6px 0 0", fontSize: 14 }}>
            {isRegistering
              ? "Join us to start practicing."
              : "Login to access your dashboard."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login__field">
            <label>Email Address</label>
            <input
              type="email"
              id="auth-email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="login__field">
            <label>Password</label>
            <input
              type="password"
              id="auth-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--primary btn--block" id="auth-submit-btn" style={{ marginTop: 8 }}>
            {isRegistering ? "Register" : "Login"}
          </button>
        </form>

        <div className="login__divider">OR</div>

        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={signInWithGoogle}
          style={{ gap: 10 }}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            width="18"
            alt="Google"
          />
          Continue with Google
        </button>

        <div className="text-center" style={{ marginTop: 18 }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            {isRegistering ? "Already have an account? " : "Don't have an account? "}
            <a
              href="#"
              style={{ fontWeight: 600 }}
              onClick={(e) => {
                e.preventDefault();
                toggleAuthMode();
              }}
            >
              {isRegistering ? "Login here" : "Register here"}
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
