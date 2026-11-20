import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { SearchHead } from "./SearchHead.jsx";
import "./styles.css";
document.documentElement.dataset.interactive = "";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SearchHead />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

if (import.meta.env.DEV && new URLSearchParams(location.search).has("audit")) {
  import("./dev-audit.js");
}
