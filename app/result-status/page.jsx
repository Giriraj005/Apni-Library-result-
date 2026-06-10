"use client";

import { useState } from "react";

function statusTone(status) {
  const s = String(status || "").toLowerCase();

  if (s.includes("result_found")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (s.includes("not_found") || s.includes("failed")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (s.includes("queue") || s.includes("checking")) {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

export default function ResultStatusPage() {
  const [rollNo, setRollNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function checkStatus(e) {
    e.preventDefault();

    setError("");
    setData(null);

    if (!rollNo.trim()) {
      setError("Please enter roll number.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `/api/result-status?rollNo=${encodeURIComponent(rollNo.trim())}`
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Status check failed");
      }

      setData(json);
    } catch (err) {
      setError(err.message || "Status check failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-slate-950">
      <section className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.10),transparent_35%)]" />

        <div className="relative mx-auto max-w-5xl">
          <div className="mb-7">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-700">
              Apni Library
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              Check Result Alert Status
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Apna roll number enter karke registration, queue, result aur
              WhatsApp delivery status check karein.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-2xl shadow-amber-900/10 sm:p-8">
            <form onSubmit={checkStatus} className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Roll Number
                </span>
                <input
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                  placeholder="Example: 26331464"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                />
              </label>

              <button
                disabled={loading}
                className="self-end rounded-2xl bg-slate-950 px-8 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl transition hover:bg-amber-600 disabled:opacity-60"
              >
                {loading ? "Checking..." : "Check Status"}
              </button>
            </form>

            {error ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                {error}
              </div>
            ) : null}

            {data ? (
              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black">Status Results</h2>
                  <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600">
                    {data.total || 0} registration(s)
                  </span>
                </div>

                {data.registrations?.length ? (
                  <div className="space-y-4">
                    {data.registrations.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                              {item.studentName || "Student"}
                            </p>
                            <h3 className="mt-1 text-xl font-black text-slate-950">
                              {item.yearPart}
                            </h3>
                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              Roll No: {item.rollNo}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-4 py-2 text-xs font-black uppercase ${statusTone(
                              item.status
                            )}`}
                          >
                            {item.status || "waiting"}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-bold text-slate-500">
                              Result Found
                            </p>
                            <p className="mt-1 text-lg font-black">
                              {yesNo(item.resultFound)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-bold text-slate-500">
                              Admin Preview
                            </p>
                            <p className="mt-1 text-lg font-black">
                              {yesNo(item.adminTelegramSent)}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-bold text-slate-500">
                              WhatsApp Sent
                            </p>
                            <p className="mt-1 text-lg font-black">
                              {yesNo(item.studentWhatsAppSent)}
                            </p>
                          </div>
                        </div>

                        {item.officialUrl || item.formUrl ? (
                          <a
                            href={item.officialUrl || item.formUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-black text-amber-800"
                          >
                            Open Official Result Page
                          </a>
                        ) : null}

                        {item.studentWhatsAppLastError ? (
                          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">
                            WhatsApp issue: {item.studentWhatsAppLastError}
                          </div>
                        ) : null}

                        {item.resultSummary ? (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                              Result Summary
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                              {item.resultSummary}
                            </p>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
                    <p className="text-lg font-black text-amber-900">
                      No registration found
                    </p>
                    <p className="mt-2 text-sm font-semibold text-amber-800">
                      Is roll number ke liye abhi koi result alert registration
                      nahi mila.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
