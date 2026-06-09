import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f3ec] text-slate-950">
      <section className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.10),transparent_35%)]" />

        <div className="relative mx-auto max-w-6xl">
          <nav className="mb-10 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-700">
                Apni Library
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                PDUSU Result Automation
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-bold text-slate-500">System</p>
              <p className="text-sm font-black text-emerald-700">Live</p>
            </div>
          </nav>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[2.2rem] border border-white/80 bg-white/85 p-6 shadow-2xl shadow-amber-900/10 backdrop-blur sm:p-10">
              <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-300">
                  Result Alert Engine
                </p>
                <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
                  PDUSU Result Alert
                </h1>
                <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-200">
                  Register once. System official result forms monitor karega,
                  Railway browser worker se result fetch karega, admin Telegram
                  par preview bhejega aur student WhatsApp par summary bhejega.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/result-alert"
                  className="rounded-2xl bg-amber-500 px-5 py-4 text-center text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-amber-500/25 transition hover:bg-amber-600"
                >
                  Register Result Alert
                </Link>

                <Link
                  href="/result-status"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-sm font-black uppercase tracking-wide text-slate-900 shadow-lg transition hover:border-amber-400"
                >
                  Check Status
                </Link>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-black text-slate-950">5 min</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Cron Monitoring
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-black text-slate-950">Auto</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Queue Processing
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-black text-slate-950">Live</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Official Forms
                  </p>
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-xl shadow-amber-900/10">
                <h2 className="text-xl font-black text-slate-950">
                  How it works
                </h2>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black">1. Student registers</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Exact official course option and WhatsApp number save hota
                      hai.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black">2. Worker fetches result</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Railway browser worker official result page open karke
                      marks fetch karta hai.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black">3. Alerts are sent</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Admin Telegram par preview, student WhatsApp par summary.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] bg-amber-500 p-6 text-white shadow-xl shadow-amber-500/20">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-100">
                  Important
                </p>
                <h3 className="mt-2 text-2xl font-black">
                  Exact course choose karo
                </h3>
                <p className="mt-3 text-sm leading-6 text-amber-50">
                  NEP aur Annual result forms अलग हो सकते हैं. Registration me
                  exact official dropdown option select karna जरूरी है.
                </p>
              </div>

              <Link
                href="/admin/result-alert"
                className="block rounded-[2rem] border border-slate-200 bg-white/80 p-6 text-center text-sm font-black uppercase tracking-wide text-slate-900 shadow-lg transition hover:border-amber-400"
              >
                Admin Dashboard
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
