"use client";

import { useState } from "react";

export default function ResultStatusPage() {
  const [rollNo, setRollNo] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function check(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/check-result-status?rollNo=${encodeURIComponent(rollNo)}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ padding: "36px 0" }}>
      <section className="card" style={{ padding: 24 }}>
        <span className="badge">Status</span>
        <h1>Check Result Alert Status</h1>
        <p className="muted">Apna roll number enter karke registration/result status check karein.</p>

        <form onSubmit={check} className="grid" style={{ marginTop: 18 }}>
          <div>
            <label className="label">Roll Number</label>
            <input className="input" value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="Enter roll number" />
          </div>
          <button className="btn" disabled={loading}>{loading ? "Checking..." : "Check Status"}</button>
        </form>

        {result && (
          <div className="card" style={{ padding: 18, marginTop: 18 }}>
            {result.success ? (
              <>
                <span className="badge success">{result.status}</span>
                <h3 style={{ marginBottom: 6 }}>{result.title}</h3>
                <p className="muted">{result.message}</p>
                {result.output?.telegramSent && <p>Telegram group me result preview send ho chuki hai.</p>}
              </>
            ) : (
              <>
                <span className="badge error">Not Found</span>
                <p>{result.error || "No registration found."}</p>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
