import React from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "react-toastify/dist/ReactToastify.css"
import { ToastContainer } from "react-toastify"
import App from "./App"

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <ToastContainer position="top-right" autoClose={3500} newestOnTop closeOnClick pauseOnHover theme="colored" />
  </React.StrictMode>
)