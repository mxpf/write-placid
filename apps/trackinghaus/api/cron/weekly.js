import { siteConfigured, siteKey, timeZone } from "../../lib/config.js";
import { databaseConfigured, getAggregateRows } from "../../lib/db.js";
import { addDays, isoFromDate } from "../../lib/dates.js";
import { emailConfigured, sendWeeklyEmail } from "../../lib/email.js";
import { json, methodNotAllowed } from "../../lib/http.js";
import { buildWeeklySummary } from "../../lib/summary.js";

function authorization(request) {
  return request.headers?.authorization || request.headers?.Authorization || "";
}

export default async function handler(request, response) {
  if (request.method !== "GET") return methodNotAllowed(response, ["GET"]);
  if (!emailConfigured()) {
    return json(response, 200, { ok: true, skipped: "email_not_configured" });
  }
  if (!process.env.CRON_SECRET || authorization(request) !== `Bearer ${process.env.CRON_SECRET}`) {
    return json(response, 401, { error: "unauthorized" });
  }
  if (!siteConfigured()) return json(response, 503, { error: "site_not_configured" });
  if (!databaseConfigured()) return json(response, 503, { error: "storage_not_configured" });

  try {
    const today = isoFromDate(new Date(), timeZone());
    const end = addDays(today, -1);
    const start = addDays(end, -13);
    const rows = await getAggregateRows({ site: siteKey(), start, end });
    const summary = buildWeeklySummary(rows, { endDate: end, today: null });
    const result = await sendWeeklyEmail(summary);
    return json(response, 200, {
      ok: true,
      range: summary.range,
      emailId: result?.id || null,
    });
  } catch (error) {
    console.error("trackinghaus_weekly_email_failed", error);
    return json(response, 500, { error: "weekly_email_failed" });
  }
}
