"use client";

import { useEffect, useState } from "react";

export default function AdminCaptchaPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);

  async function api(method, body) {
    const res = await fetch("/api/captcha-solve", {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res
      .json()
      .catch(() => ({ success: false, error: "Bad response from server" }));

    if (!res.ok || data.success === false) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  async function loadItems(secret = adminSecret) {
    if (!secret) return;

    setBusy("load");

    try {
      const res = await fetch("/api/captcha-solve", {
        headers: { "x-admin-secret": secret }
      });
      const data = await res.json();

      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Could not load the list");
      }

      setItems(data.items || []);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    const fromUrl =
      new URLSearchParams(window.location.search).get("admin") || "";

    if (fromUrl) {
      setAdminSecret(fromUrl);
      loadItems(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish(result, item) {
    if (result.state === "found") {
      setMessage({ type: "ok", text: "Result found. Sending alerts..." });
      setActive(null);

      try {
        const out = await api("POST", { action: "flush" });
        const d = out.data || {};

        setMessage({
          type: "ok",
          text: out.ok
            ? `Done for ${item.rollNo}. Found ${d.found ?? 0}, alerts sent by the queue run.`
            : `Saved for ${item.rollNo}. The queue run failed, alerts will go out on the next cron run.`
        });
      } catch {
        setMessage({
          type: "ok",
          text: `Saved for ${item.rollNo}. Alerts will go out on the next cron run.`
        });
      }
    } else if (result.state === "not_found") {
      setActive(null);
      setMessage({
        type: "warn",
        text: `No result for ${item.rollNo}: ${result.reason || "record not found"}`
      });
    } else {
      setActive(null);
      setMessage({
        type: "warn",
        text: `Could not read the page for ${item.rollNo} (${result.status || "unclear"}). Try again.`
      });
    }

    setText("");
    await loadItems();
  }

  async function startSolve(item) {
    setBusy("start");
    setMessage(null);
    setText("");

    try {
      const out = await api("POST", {
        action: "start",
        queueId: item.queueId
      });

      if (out.state === "awaiting_captcha") {
        setActive({
          item,
          sessionId: out.sessionId,
          imageBase64: out.imageBase64,
          fullPage: out.fullPage
        });
      } else {
        await finish(out, item);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy("");
    }
  }

  async function submitCaptcha() {
    if (!active || !text.trim()) return;

    setBusy("submit");
    setMessage(null);

    try {
      const out = await api("POST", {
        action: "submit",
        queueId: active.item.queueId,
        sessionId: active.sessionId,
        text: text.trim()
      });

      if (out.state === "captcha_rejected") {
        setActive({ ...active, imageBase64: out.imageBase64, fullPage: out.fullPage });
        setText("");
        setMessage({
          type: "warn",
          text: "Wrong CAPTCHA. A new one is shown, try again."
        });
      } else if (out.state === "expired") {
        setActive(null);
        setText("");
        setMessage({
          type: "warn",
          text: `Wrong CAPTCHA (${out.reason || "no reason"}). A new one is shown, try again.`
        });
      } else {
        await finish(out, active.item);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusy("");
    }
  }

  async function cancelSolve() {
    const sessionId = active?.sessionId;

    setActive(null);
    setText("");

    if (sessionId) {
      api("POST", { action: "cancel", sessionId }).catch(() => {});
    }
  }

  const tone = {
    ok: "border-emerald-300 bg-emerald-50 text-emerald-800",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    error: "border-red-300 bg-red-50 text-red-800"
  };

  return (
    <main className="min-h-screen bg-[#f7f3ec] px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-700">
          Apni Library Admin
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">
          Enter CAPTCHA
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          The university now asks for a CAPTCHA. Pick a roll number, read the
          image, type it here. Alerts are sent automatically after that.
        </p>

        {message && (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${tone[message.type]}`}
          >
            {message.text}
          </div>
        )}

        {!adminSecret && (
          <div className="mt-5 rounded-3xl bg-white p-4 shadow-lg">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Admin secret
            </label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base"
              onChange={(e) => setAdminSecret(e.target.value)}
            />
            <button
              className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-black text-white disabled:opacity-40"
              disabled={!adminSecret}
              onClick={() => loadItems()}
            >
              Load list
            </button>
          </div>
        )}

        {active ? (
          <div className="mt-5 rounded-3xl bg-white p-4 shadow-lg">
            <p className="text-sm font-black">
              {active.item.rollNo}
              <span className="ml-2 font-semibold text-slate-500">
                {active.item.yearPart}
              </span>
            </p>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${active.imageBase64}`}
              alt="CAPTCHA"
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white"
            />

            {active.fullPage && (
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Could not crop the CAPTCHA, so this is the whole page. Find it
                in the form.
              </p>
            )}

            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCaptcha();
              }}
              placeholder="Type the CAPTCHA"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-3 text-lg tracking-widest"
            />

            <button
              className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-black text-white disabled:opacity-40"
              disabled={busy === "submit" || !text.trim()}
              onClick={submitCaptcha}
            >
              {busy === "submit" ? "Checking..." : "Show result"}
            </button>

            <button
              className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-bold text-slate-600"
              disabled={busy === "submit"}
              onClick={cancelSolve}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {items.length === 0 && adminSecret && busy !== "load" && (
              <div className="rounded-3xl bg-white p-4 text-sm font-semibold text-slate-600 shadow-lg">
                Nothing is waiting for a CAPTCHA.
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.queueId}
                className="flex items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-lg"
              >
                <div>
                  <p className="text-base font-black">{item.rollNo}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    {item.yearPart}
                  </p>
                </div>

                <button
                  className="shrink-0 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
                  disabled={Boolean(busy)}
                  onClick={() => startSolve(item)}
                >
                  {busy === "start" ? "Opening..." : "Enter CAPTCHA"}
                </button>
              </div>
            ))}

            {adminSecret && (
              <button
                className="w-full rounded-xl px-4 py-2 text-sm font-bold text-slate-600"
                disabled={Boolean(busy)}
                onClick={() => loadItems()}
              >
                {busy === "load" ? "Loading..." : "Refresh list"}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
