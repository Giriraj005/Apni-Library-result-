"use client";

import { useEffect, useState } from "react";

function AdminBox({ title, value, tone }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <p className="muted" style={{ margin: 0 }}>
        {title}
      </p>

      <h2 style={{ margin: "8px 0 0" }}>{value}</h2>

      {tone && <span className={`badge ${tone}`}>{tone}</span>}
    </div>
  );
}

export default function AdminResultAlertPage() {
  const [admin, setAdmin] = useState("");
  const [testMsg, setTestMsg] = useState("");

  const [manual, setManual] = useState({
    resultFormUrl: "",
    yearPart: "B.A. SEMESTER I",
    resultType: "MAIN",
    rollNo: ""
  });

  const [manualResult, setManualResult] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAdmin(params.get("admin") || "");
  }, []);

  async function api(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": admin
      },
      body: JSON.stringify(body || {})
    });

    return res.json();
  }

  async function runTelegramTest() {
    const data = await api("/api/telegram-test", {
      message: "✅ Apni Library Result Alert test message"
    });

    setTestMsg(JSON.stringify(data, null, 2));
  }

  async function runManualTest() {
    setManualResult({
      loading: true
    });

    const data = await api("/api/admin-test-result", manual);
    setManualResult(data);
  }

  async function runDiscovery() {
    const secret = prompt("Enter CRON_SECRET");

    if (!secret) return;

    const res = await fetch(
      `/api/discover-result-portal?secret=${encodeURIComponent(secret)}`
    );

    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
  }

  return (
    <main className="container" style={{ padding: "28px 0" }}>
      <section className="card" style={{ padding: 24, marginBottom: 18 }}>
        <span className="badge">Admin</span>

        <h1>Result Alert Admin Dashboard</h1>

        <p className="muted">
          Portal discovery, manual test, Telegram test, queue and logs controls.
        </p>
      </section>

      <section
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          marginBottom: 18
        }}
      >
        <AdminBox title="Monitoring" value="Every 5 min" tone="success" />
        <AdminBox title="Delivery" value="Telegram Group" />
        <AdminBox title="Target" value="Sem I/III/V" />
        <AdminBox title="Mode" value="Safe Public Sources" />
      </section>

      <section
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
        }}
      >
        <div className="card" style={{ padding: 22 }}>
          <h2>Portal Discovery</h2>

          <p className="muted">
            shekhauniexam.in se latest 2025-26 result portal discover karega.
          </p>

          <button className="btn" onClick={runDiscovery}>
            Run Discovery Now
          </button>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <h2>Telegram Test</h2>

          <p className="muted">
            Private group/admin chat me test message send karein.
          </p>

          <button className="btn" onClick={runTelegramTest}>
            Send Test Message
          </button>

          {testMsg && (
            <pre style={{ whiteSpace: "pre-wrap" }}>{testMsg}</pre>
          )}
        </div>

        <div className="card" style={{ padding: 22 }}>
          <h2>Manual Result Test</h2>

          <div className="grid">
            <input
              className="input"
              placeholder="Optional Result Form URL"
              value={manual.resultFormUrl}
              onChange={(e) =>
                setManual({
                  ...manual,
                  resultFormUrl: e.target.value
                })
              }
            />

            <input
              className="input"
              placeholder="Year Part e.g. B.A. SEMESTER I"
              value={manual.yearPart}
              onChange={(e) =>
                setManual({
                  ...manual,
                  yearPart: e.target.value
                })
              }
            />

            <input
              className="input"
              placeholder="Result Type"
              value={manual.resultType}
              onChange={(e) =>
                setManual({
                  ...manual,
                  resultType: e.target.value
                })
              }
            />

            <input
              className="input"
              placeholder="Roll Number"
              value={manual.rollNo}
              onChange={(e) =>
                setManual({
                  ...manual,
                  rollNo: e.target.value
                })
              }
            />

            <button className="btn" onClick={runManualTest}>
              Test Result Fetch
            </button>
          </div>

          {manualResult && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                maxHeight: 360,
                overflow: "auto"
              }}
            >
              {JSON.stringify(manualResult, null, 2)}
            </pre>
          )}
        </div>
      </section>
    </main>
  );
}
