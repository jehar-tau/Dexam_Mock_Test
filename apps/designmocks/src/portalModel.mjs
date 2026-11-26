export const portalItems = Object.freeze([
  { to: "/dashboard", label: "Overview", mark: "O", end: true, released: true },
  { to: "/papers", label: "Papers", mark: "Y", released: true },
  { to: "/dashboard/practice", label: "Topic practice", mark: "P", released: false },
  { to: "/dashboard/all-india", label: "All India mocks", mark: "A", released: false },
  { to: "/dashboard/mocks", label: "Exam-wise mocks", mark: "M", released: false },
  { to: "/dashboard/learn", label: "Learn", mark: "L", released: false },
  { to: "/dashboard/community", label: "Community", mark: "C", released: false },
]);

export const portalModules = Object.freeze({
  mocks: ["Exam-wise mocks", "Choose UCEED, NID, NIFT or CEED. Each released attempt will be assembled from reviewed, hold-free questions and frozen when you begin."],
  "all-india": ["All India mocks", "One fixed paper per exam, one attempt per account, a controlled window and ranks released only after review."],
  practice: ["Topic practice", "Build a 10, 20 or 30-question session by topic, with a 15, 30 or 45-minute timer."],
  learn: ["Learn", "Theory notes and guided learning paths will appear here after the owner content review."],
  community: ["Community", "Discuss questions and solutions in moderated threads. Direct messaging will remain off at launch."],
});
