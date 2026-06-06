export default function HomePage() {
  return (
    <main className="container" style={{ padding: "56px 0" }}>
      <section className="card" style={{ padding: 28 }}>
        <span className="badge">Apni Library</span>
        <h1 style={{ fontSize: 42, lineHeight: 1.1, marginBottom: 12 }}>
          PDUSU Result Alert Engine
        </h1>
        <p className="muted" style={{ fontSize: 18, maxWidth: 720 }}>
          Register roll numbers before the result is live. The system checks the official university result portal every 5 minutes and sends registered students’ result preview image to your private Telegram group after confirmation.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
          <a className="btn" href="/result-alert">Register Result Alert</a>
          <a className="btn secondary" href="/result-status">Check Status</a>
        </div>
      </section>
    </main>
  );
}
