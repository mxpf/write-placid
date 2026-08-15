import { useCallback, useEffect, useRef, useState } from "react";
import { loadWeekly } from "./api.js";
import { demoWeekly } from "./demo-data.js";
import { LetterCascade } from "./LetterCascade.jsx";

function splitDetail(detail) {
  const boundary = detail.indexOf(". ");
  if (boundary === -1) return [detail, ""];
  return [detail.slice(0, boundary + 1), detail.slice(boundary + 2)];
}

function changeLabel(change) {
  if (!change) return "—";
  return change > 0 ? `+${change}` : String(change);
}

function TrendChart({ days }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * ratio);
      canvas.height = Math.round(bounds.height * ratio);

      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      context.clearRect(0, 0, bounds.width, bounds.height);

      const styles = getComputedStyle(document.documentElement);
      const ink = styles.getPropertyValue("--ink").trim() || "#eeede9";

      const labelInset = 24;
      const left = labelInset;
      const right = bounds.width - labelInset;
      const pointTop = 29;
      const pointBottom = 78;
      const values = days.map((item) => item.value);
      const minimum = Math.min(...values);
      const maximum = Math.max(...values);
      const spread = maximum - minimum;
      const points = days.map((item, index) => ({
        x: left + (index * (right - left)) / Math.max(days.length - 1, 1),
        y:
          spread === 0
            ? (pointTop + pointBottom) / 2
            : pointBottom -
              ((item.value - minimum) / spread) * (pointBottom - pointTop),
      }));

      context.strokeStyle = ink;
      context.lineWidth = 1;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.beginPath();
      points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();

      context.fillStyle = ink;
      points.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 3, 0, Math.PI * 2);
        context.fill();
      });

      const family = '"Instrument Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';
      context.font = `400 16px ${family}`;
      context.textBaseline = "top";

      days.forEach((item, index) => {
        const x = points[index].x;
        context.textAlign = "center";
        context.fillText(item.date, x, 154);
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [days]);

  const caption = `Daily reads from ${days[0]?.date || "the start of the week"} through ${days.at(-1)?.date || "today"}: ${days.map((day) => day.value).join(", ")}.`;

  return (
    <figure className="trend" aria-labelledby="trend-caption">
      <canvas ref={canvasRef} className="trend-canvas" aria-hidden="true" />
      <figcaption id="trend-caption" className="visually-hidden">
        {caption}
      </figcaption>
    </figure>
  );
}

function WeeklyReading({ data, onOpenPieceReading }) {
  const [firstDetail, secondDetail] = splitDetail(data.insight.detail);
  return (
    <section aria-labelledby="week-title">
      <header className="period">
        <h1 id="week-title">This week</h1>
        <p>{data.range.label}</p>
      </header>

      <div className="insight">
        <h2>{data.insight.headline}</h2>
        <p>
          <span className="nowrap">{firstDetail}</span>
          {secondDetail ? (
            <>
              <br />
              {secondDetail}
            </>
          ) : null}
        </p>
      </div>

      <TrendChart days={data.days} />

      <section className="evidence" id="evidence" aria-labelledby="evidence-title">
        <h2 id="evidence-title">What changed</h2>
        <dl>
          {data.evidence.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>
                {item.value} {item.suffix}
              </dd>
            </div>
          ))}
        </dl>
        {data.evidenceNote ? <p>{data.evidenceNote}</p> : null}
        <p className="piece-reading-link">
          See this week’s{" "}
          <button className="text-link inline-link" type="button" onClick={onOpenPieceReading}>
            reading by piece
          </button>
          , including how each changed from last week.
        </p>
      </section>
    </section>
  );
}

function ReadingByPieceView({ data, onBack }) {
  return (
    <section className="secondary-view" aria-labelledby="piece-reading-title">
      <header className="period">
        <h1 id="piece-reading-title">Reading by piece</h1>
        <p>{data.range.label}</p>
      </header>

      {data.writing.length ? (
        <ol className="writing-list">
          {data.writing.map((item) => (
            <li key={item.path}>
              <span>{item.title}</span>
              <span>{item.readers} reads</span>
              <span aria-label={`${changeLabel(item.change)} reads from last week`}>
                {changeLabel(item.change)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-reading">The first piece-by-piece reading appears after a few visits.</p>
      )}

      <button className="text-link" type="button" onClick={onBack}>
        This week
      </button>
    </section>
  );
}

function SetupView({ code }) {
  const copy = {
    site_not_configured: "Add your blog details in the Trackinghaus alpha environment settings.",
    storage_not_configured: "Connect the Trackinghaus alpha database in Vercel.",
  }[code];
  return (
    <section className="access-view" aria-labelledby="setup-title">
      <header className="period">
        <h1 id="setup-title">Almost ready</h1>
        <p>Trackinghaus alpha setup</p>
      </header>
      <p className="setup-message">{copy || "Trackinghaus alpha needs its production configuration."}</p>
    </section>
  );
}

function viewFromLocation() {
  const view = new URLSearchParams(window.location.search).get("view");
  return view === "pieces" || view === "writing" ? "pieces" : "week";
}

function locationForView(view) {
  const url = new URL(window.location.href);
  if (view === "pieces") url.searchParams.set("view", "pieces");
  else url.searchParams.delete("view");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function App() {
  const demoMode = import.meta.env.DEV && import.meta.env.VITE_USE_LIVE_API !== "true";
  const [view, setView] = useState(viewFromLocation);
  const [state, setState] = useState({
    status: demoMode ? "ready" : "loading",
    data: demoMode ? demoWeekly : null,
    code: null,
  });
  const refresh = useCallback(async () => {
    try {
      const data = await loadWeekly();
      setState({ status: "ready", data, code: null });
    } catch (error) {
      if (error.status === 503) {
        setState({ status: "setup", data: null, code: error.code });
      } else setState({ status: "error", data: null, code: error.code });
    }
  }, []);

  useEffect(() => {
    if (!demoMode) refresh();
  }, [demoMode, refresh]);

  useEffect(() => {
    const handlePopState = () => {
      setView(viewFromLocation());
      window.scrollTo({ top: 0, behavior: "auto" });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const show = (nextView) => {
    if (nextView === view) return;
    window.history.pushState({ trackinghausView: nextView }, "", locationForView(nextView));
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const ready = state.status === "ready";
  const site = ready ? state.data.site : null;
  return (
    <div className="app-shell">
      <header className="brand">
        <button type="button" onClick={() => (ready ? show("week") : undefined)}>
          <LetterCascade text="Trackinghaus alpha" />
        </button>
      </header>

      <main className="content" aria-live="polite" aria-busy={state.status === "loading"}>
        {state.status === "loading" ? (
          <p className="loading-copy">Opening Trackinghaus alpha…</p>
        ) : state.status === "setup" ? (
          <SetupView code={state.code} />
        ) : state.status === "error" ? (
          <SetupView code="unknown" />
        ) : view === "week" ? (
          <WeeklyReading
            data={state.data}
            onOpenPieceReading={() => show("pieces")}
          />
        ) : (
          <ReadingByPieceView data={state.data} onBack={() => show("week")} />
        )}
      </main>

      <footer className="site-footer">
        {site?.origin ? (
          <a className="footer-brand text-link" href={site.origin}>
            {site.name}
          </a>
        ) : null}
        {ready ? (
          <nav className="footer-nav" aria-label="Primary">
            <a className="text-link" href={site.repository}>
              GitHub
            </a>
          </nav>
        ) : null}
      </footer>
    </div>
  );
}
