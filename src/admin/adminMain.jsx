import React from "react";
import { createRoot } from "react-dom/client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./admin.css";
import AdminApp from "./AdminApp";

createRoot(document.getElementById("admin-root")).render(
  <React.StrictMode>
    <AdminApp />
    <ToastContainer
      position="top-right"
      autoClose={3000}
      newestOnTop
      closeOnClick
      pauseOnHover
      theme="colored"
    />
  </React.StrictMode>
);
