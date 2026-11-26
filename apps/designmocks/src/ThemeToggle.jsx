import React, { useEffect, useState } from "react";

export function Theme({ className = "theme icon-button" }) {
  const [dark, setDark] = useState(
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark",
  );
  // Several toggles can exist (site header, exam bar); keep each in sync.
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(root.dataset.theme === "dark"));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return (
    <button
      className={className}
      aria-label="Dark mode"
      role="switch"
      aria-checked={dark}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? "dark" : "light";
        try {
          localStorage.setItem("designmocks-theme", next ? "dark" : "light");
        } catch {}
      }}
    >
      {dark ? (
        <span aria-hidden="true">☀</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M20 14A8 8 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z" />
        </svg>
      )}
    </button>
  );
}
