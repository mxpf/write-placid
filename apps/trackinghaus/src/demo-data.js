export const demoWeekly = {
  range: { start: "2026-08-03", end: "2026-08-09", label: "August 3–9, 2026" },
  insight: {
    headline: "An old essay found new readers.",
    detail: "Notes on Small Software was read by 78 people. 34 arrived through search.",
    primaryTitle: "Notes on Small Software",
    total: 78,
    search: 34,
    returning: 17,
  },
  days: [
    { iso: "2026-08-03", day: "Mon", date: "8/3", value: 8 },
    { iso: "2026-08-04", day: "Tue", date: "8/4", value: 11 },
    { iso: "2026-08-05", day: "Wed", date: "8/5", value: 7 },
    { iso: "2026-08-06", day: "Thu", date: "8/6", value: 13 },
    { iso: "2026-08-07", day: "Fri", date: "8/7", value: 15 },
    { iso: "2026-08-08", day: "Sat", date: "8/8", value: 21, today: true },
    { iso: "2026-08-09", day: "Sun", date: "8/9", value: 10 },
  ],
  evidence: [
    { label: "Search", value: 34, suffix: "reads" },
    { label: "Direct links", value: 27, suffix: "reads" },
    { label: "Returning", value: 17, suffix: "reads" },
  ],
  evidenceNote:
    "Search accounted for 44% of this week’s reading. No individual visitors are identified. Trackinghaus alpha stores only aggregate counters.",
  writing: [
    { path: "/notes-on-small-software", title: "Notes on Small Software", readers: 78, change: 42 },
    { path: "/a-small-internet", title: "A Small Internet", readers: 41, change: 9 },
    { path: "/the-shape-of-enough", title: "The Shape of Enough", readers: 26, change: 3 },
    { path: "/against-the-dashboard", title: "Against the Dashboard", readers: 19, change: 0 },
  ],
  site: {
    key: "example-blog",
    name: "Example blog",
    origin: "https://example.com",
    repository: "https://github.com/your-name/write-placid",
  },
};
