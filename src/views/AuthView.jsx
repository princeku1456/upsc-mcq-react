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
    if (isRegistering) setPassword(""); // same as clearing password on register
  };

  return (
    <section id="hero-section" className="hero" style={{ marginTop: 100 }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-5">
            <div className="card auth-card text-center animate-fade-in">
              <div className="card-body p-5">
                <h3 className="fw-bold text-primary mb-2" id="auth-title">
                  {isRegistering ? "Create Account" : "Welcome Back! 👋"}
                </h3>
                <p className="text-muted mb-4" id="auth-subtitle">
                  {isRegistering
                    ? "Join us to start practicing."
                    : "Login to access your dashboard."}
                </p>
                <form id="auth-form" onSubmit={handleSubmit}>
                  <div className="mb-3 text-start">
                    <label className="form-label text-muted small fw-bold">
                      Email Address
                    </label>
                    <input
                      type="email"
                      className="form-control form-control-lg"
                      id="auth-email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="mb-3 text-start">
                    <label className="form-label text-muted small fw-bold">
                      Password
                    </label>
                    <input
                      type="password"
                      className="form-control form-control-lg"
                      id="auth-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary-custom w-100 py-3 mt-3 shadow"
                    id="auth-submit-btn"
                  >
                    {isRegistering ? "Register" : "Login"}
                  </button>
                </form>
                <div id="google-auth-container">
                  <div className="d-flex align-items-center my-4">
                    <hr className="flex-grow-1" />
                    <span className="mx-2 text-muted small">OR</span>
                    <hr className="flex-grow-1" />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary-custom w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                    onClick={signInWithGoogle}
                  >
                    <img
                      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                      width="18"
                      alt="Google"
                    />
                    Continue with Google
                  </button>
                </div>
                <div className="mt-4">
                  <small className="text-muted">
                    {isRegistering
                      ? "Already have an account? "
                      : "Don't have an account? "}
                    <a
                      href="#"
                      className="text-primary fw-bold text-decoration-none"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleAuthMode();
                      }}
                    >
                      {isRegistering ? "Login here" : "Register here"}
                    </a>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
