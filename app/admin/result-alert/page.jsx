"use client";

import { useMemo, useState } from "react";

function getQueryValue(name) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
}

function prettyJson(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data || "");
  }
}

export default function AdminResultAlertPage() {
  const [adminSecret, setAdminSecret] = useState(() => getQueryValue("admin"));
  const [cronSecret, setCronSecret] = useState("");
  const [manualForm, setManualForm] = useState({
    formUrl: "https://result26.shekhauniexam.in/PG_NEP_RESULT.aspx",
    yearPart: "M.COM ABST SEMESTER I",
    resultType: "MAIN",
    rollNo: ""
  });

  const [queueForm, setQueueForm] = useState({
    yearParts: "M.COM ABST SEMESTER I",
    resultType: "MAIN"
  });

  const [loading, setLoading] = useState("");
  const [output, setOutput] = useState(null);

  const adminReady = useMemo(() => Boolean(adminSecret), [adminSecret]);
  const cronReady = useMemo(() => Boolean(cronSecret), [cronSecret]);

  async function runApi(label, url) {
    setLoading(label);
    setOutput(null);

    try {
      const res = await fetch(url);
      const data = await res.json();

      setOutput({
        label,
        ok: res.ok,
        data
      });
    } catch (err) {
      setOutput({
        label,
        ok: false,
        data: {
          success: false,
          error: err.message || "Request failed"
        }
      });
    } finally {
      setLoading("");
    }
  }

  function updateManual(name, value) {
    setManualForm((old) => ({
      ...old,
      [name]: value
    }));
  }

  function updateQueue(name, value) {
    setQueueForm((old) => ({
      ...old,
      [name]: value
    }));
  }

  const disabledAdmin = !adminReady || Boolean(loading);
  const disabledCron = !cronReady || Boolean(loading);

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-slate-950">
      <section className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.10),transparent_35%)]" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-700">
                Apni Library Admin
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
                Result Alert Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                Portal discovery, queue automation, Railway worker result fetch,
                Telegram delivery, WhatsApp retry and manual result testing.
              </p>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white/80 px-5 py-4 text-right shadow-lg">
              <p className="text-xs font-bold text-slate-500">System Mode</p>
              <p className="text-sm font-black text-emerald-700">
                Worker + Auto Queue
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-xl shadow-amber-900/10">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Monitoring
              </p>
              <p className="mt-2 text-2xl font-black">Every 5 min</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700">
                Cron ready
              </p>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-xl shadow-amber-900/10">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Delivery
              </p>
              <p className="mt-2 text-2xl font-black">Telegram</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Admin groups
              </p>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-xl shadow-amber-900/10">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Worker
              </p>
              <p className="mt-2 text-2xl font-black">Railway</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Browser fetch
              </p>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-xl shadow-amber-900/10">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                WhatsApp
              </p>
              <p className="mt-2 text-2xl font-black">Auto</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Free-form first
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-amber-900/10">
                <h2 className="text-xl font-black">Secrets</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Admin secret URL se auto-filled hai. Cron secret only for cron
                  endpoints testing.
                </p>

                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Admin Secret
                    </span>
                    <input
                      value={adminSecret}
                      onChange={(e) => setAdminSecret(e.target.value)}
                      placeholder="Admin secret"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Cron Secret
                    </span>
                    <input
                      value={cronSecret}
                      onChange={(e) => setCronSecret(e.target.value)}
                      placeholder="Paste CRON_SECRET for cron endpoint testing"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-amber-900/10">
                <h2 className="text-xl font-black">Quick Actions</h2>

                <div className="mt-5 grid gap-3">
                  <button
                    disabled={disabledAdmin}
                    onClick={() =>
                      runApi(
                        "Telegram Test",
                        `/api/telegram-test?admin=${encodeURIComponent(
                          adminSecret
                        )}`
                      )
                    }
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg hover:bg-amber-600 disabled:opacity-50"
                  >
                    {loading === "Telegram Test"
                      ? "Sending..."
                      : "Send Telegram Test"}
                  </button>

                  <button
                    disabled={disabledCron}
                    onClick={() =>
                      runApi(
                        "Discover Result Portal",
                        `/api/discover-result-portal?secret=${encodeURIComponent(
                          cronSecret
                        )}`
                      )
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:border-amber-400 disabled:opacity-50"
                  >
                    Run Portal Discovery
                  </button>

                  <button
                    disabled={disabledCron}
                    onClick={() =>
                      runApi(
                        "Result Monitor",
                        `/api/result-monitor?secret=${encodeURIComponent(
                          cronSecret
                        )}`
                      )
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:border-amber-400 disabled:opacity-50"
                  >
                    Run Result Monitor
                  </button>

                  <button
                    disabled={disabledCron}
                    onClick={() =>
                      runApi(
                        "Auto Queue",
                        `/api/auto-result-queue?secret=${encodeURIComponent(
                          cronSecret
                        )}`
                      )
                    }
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 hover:border-emerald-400 disabled:opacity-50"
                  >
                    Run Auto Queue
                  </button>

                  <button
                    disabled={disabledCron}
                    onClick={() =>
                      runApi(
                        "Process Queue",
                        `/api/process-result-queue?secret=${encodeURIComponent(
                          cronSecret
                        )}`
                      )
                    }
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800 hover:border-emerald-400 disabled:opacity-50"
                  >
                    Process Result Queue
                  </button>

                  <button
                    disabled={disabledCron}
                    onClick={() =>
                      runApi(
                        "Retry Student WhatsApp",
                        `/api/retry-student-whatsapp?secret=${encodeURIComponent(
                          cronSecret
                        )}`
                      )
                    }
                    className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800 hover:border-blue-400 disabled:opacity-50"
                  >
                    Retry Student WhatsApp
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-amber-900/10">
                <h2 className="text-xl font-black">Manual Result Test</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Railway worker based browser result test. Use exact official
                  dropdown option.
                </p>

                <div className="mt-5 grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Result Form URL
                    </span>
                    <input
                      value={manualForm.formUrl}
                      onChange={(e) =>
                        updateManual("formUrl", e.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Year Part
                      </span>
                      <input
                        value={manualForm.yearPart}
                        onChange={(e) =>
                          updateManual("yearPart", e.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Result Type
                      </span>
                      <select
                        value={manualForm.resultType}
                        onChange={(e) =>
                          updateManual("resultType", e.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                      >
                        <option value="MAIN">MAIN</option>
                        <option value="REVAL">REVAL</option>
                        <option value="SUPPLEMENTARY">SUPPLEMENTARY</option>
                        <option value="SPECIAL">SPECIAL</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Roll Number
                    </span>
                    <input
                      value={manualForm.rollNo}
                      onChange={(e) =>
                        updateManual("rollNo", e.target.value)
                      }
                      placeholder="Example: 26331464"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>

                  <button
                    disabled={disabledAdmin || !manualForm.rollNo}
                    onClick={() =>
                      runApi(
                        "Manual Result Fetch",
                        `/api/manual-result-fetch?admin=${encodeURIComponent(
                          adminSecret
                        )}&rollNo=${encodeURIComponent(
                          manualForm.rollNo
                        )}&yearPart=${encodeURIComponent(
                          manualForm.yearPart
                        )}&resultType=${encodeURIComponent(
                          manualForm.resultType
                        )}&formUrl=${encodeURIComponent(manualForm.formUrl)}`
                      )
                    }
                    className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl hover:bg-amber-600 disabled:opacity-50"
                  >
                    Test Result Fetch
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-amber-900/10">
                <h2 className="text-xl font-black">Create Queue Manually</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Optional manual queue creation for a specific yearPart. Cron
                  auto queue handles this in production.
                </p>

                <div className="mt-5 grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Year Parts
                    </span>
                    <input
                      value={queueForm.yearParts}
                      onChange={(e) =>
                        updateQueue("yearParts", e.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Result Type
                    </span>
                    <select
                      value={queueForm.resultType}
                      onChange={(e) =>
                        updateQueue("resultType", e.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    >
                      <option value="MAIN">MAIN</option>
                      <option value="REVAL">REVAL</option>
                      <option value="SUPPLEMENTARY">SUPPLEMENTARY</option>
                    </select>
                  </label>

                  <button
                    disabled={disabledAdmin}
                    onClick={() =>
                      runApi(
                        "Create Queue",
                        `/api/create-result-queue?admin=${encodeURIComponent(
                          adminSecret
                        )}&yearParts=${encodeURIComponent(
                          queueForm.yearParts
                        )}&resultType=${encodeURIComponent(queueForm.resultType)}`
                      )
                    }
                    className="rounded-2xl border border-amber-300 bg-amber-500 px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl hover:bg-amber-600 disabled:opacity-50"
                  >
                    Create Queue
                  </button>
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-900/10 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/20">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black">Output</h2>
                  {output ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        output.ok
                          ? "bg-emerald-400/20 text-emerald-200"
                          : "bg-red-400/20 text-red-200"
                      }`}
                    >
                      {output.ok ? "SUCCESS" : "FAILED"}
                    </span>
                  ) : null}
                </div>

                <pre className="mt-5 max-h-[520px] overflow-auto rounded-2xl bg-black/40 p-4 text-xs leading-5 text-slate-100">
                  {output
                    ? prettyJson(output)
                    : "Run any action to see API response here."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );

  function updateManual(name, value) {
    setManualForm((old) => ({
      ...old,
      [name]: value
    }));
  }

  function updateQueue(name, value) {
    setQueueForm((old) => ({
      ...old,
      [name]: value
    }));
  }
                    }
