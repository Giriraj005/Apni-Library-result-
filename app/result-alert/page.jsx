"use client";

import { useState } from "react";

const courses = ["B.A.", "B.SC", "B.COM", "B.B.A.", "B.C.A."];
const semesters = ["I", "III", "V"];

export default function ResultAlertPage() {
  const [form, setForm] = useState({
    course: "B.A.",
    semester: "I",
    resultType: "MAIN",
    rollNo: "",
    studentName: "",
    mobile: "",
    consentTelegramGroup: true
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/register-result-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setMessage({
        type: "success",
        text: `Registration successful. Tracking ID: ${data.trackingId}`
      });

      setForm((f) => ({
        ...f,
        rollNo: "",
        studentName: "",
        mobile: ""
      }));
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container" style={{ padding: "36px 0" }}>
      <section className="card" style={{ padding: 24, marginBottom: 18 }}>
        <span className="badge">Result Alert</span>

        <h1 style={{ marginBottom: 8 }}>
          PDUSU Result Alert Registration
        </h1>

        <p className="muted">
          Roll number register karo. Result official portal par live hote hi
          system check karega aur private Telegram group me result preview send
          karega.
        </p>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginTop: 18
          }}
        >
          <div className="card" style={{ padding: 16 }}>
            <b>Check Frequency</b>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Every 5 minutes
            </p>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <b>Target Result</b>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Semester I, III, V · MAIN
            </p>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <b>Delivery</b>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Private Telegram Group
            </p>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 24 }}>
        <form onSubmit={submit} className="grid">
          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <div>
              <label className="label">Course</label>
              <select
                value={form.course}
                onChange={(e) => update("course", e.target.value)}
              >
                {courses.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Semester</label>
              <select
                value={form.semester}
                onChange={(e) => update("semester", e.target.value)}
              >
                {semesters.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Result Type</label>
              <select
                value={form.resultType}
                onChange={(e) => update("resultType", e.target.value)}
              >
                <option>MAIN</option>
                <option>REVAL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Roll Number</label>
            <input
              className="input"
              value={form.rollNo}
              onChange={(e) => update("rollNo", e.target.value)}
              placeholder="Enter roll number"
              required
            />
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <div>
              <label className="label">Student Name Optional</label>
              <input
                className="input"
                value={form.studentName}
                onChange={(e) => update("studentName", e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="label">Mobile Optional</label>
              <input
                className="input"
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start"
            }}
          >
            <input
              type="checkbox"
              checked={form.consentTelegramGroup}
              onChange={(e) =>
                update("consentTelegramGroup", e.target.checked)
              }
            />

            <span className="muted">
              I agree that my result preview can be sent in the private Telegram
              group after the official result is live.
            </span>
          </label>

          <button className="btn" disabled={loading}>
            {loading ? "Registering..." : "Register Result Alert"}
          </button>

          {message && (
            <div
              className={`badge ${
                message.type === "success" ? "success" : "error"
              }`}
              style={{ justifyContent: "center" }}
            >
              {message.text}
            </div>
          )}
        </form>
      </section>
    </main>
  );
                }
