import React from "react";
import { auth } from "../lib/firebase";
import { toastr } from "../lib/toastr";

export default function AdminLogin() {
  const handleLogin = (e) => {
    e.preventDefault();
    const email = e.target.elements["admin-email"].value;
    const password = e.target.elements["admin-password"].value;
    auth.signInWithEmailAndPassword(email, password).catch((err) => toastr.error(err.message));
  };

  return (
    <section className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card shadow border-0 rounded-4 p-4">
            <h3 className="text-center fw-bold text-primary mb-2">Admin Login</h3>
            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label fw-bold small text-muted">Email</label>
                <input type="email" name="admin-email" className="form-control bg-light" required />
              </div>
              <div className="mb-4">
                <label className="form-label fw-bold small text-muted">Password</label>
                <input type="password" name="admin-password" className="form-control bg-light" required />
              </div>
              <button type="submit" className="btn btn-primary-custom w-100 py-3 rounded-3">
                Access Dashboard
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
