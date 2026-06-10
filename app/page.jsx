import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f3ec] text-slate-950">
      <section className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.24),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.10),transparent_35%)]" />

        <div className="relative mx-auto max-w-6xl">
          <nav className="mb-10 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-700">
                Apni Library
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                PDUSU Result Alerts
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-white/85 px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-bold text-slate-500">Status</p>
              <p className="text-sm font-black text-emerald-700">Active</p>
            </div>
          </nav>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[2.2rem] border border-white/80 bg-white/90 p-6 shadow-2xl shadow-amber-900/10 backdrop-blur sm:p-10">
              <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl sm:p-8">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-300">
                  Result Alert Service
                </p>

                <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">
                  PDUSU Result Alert
                </h1>

                <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-slate-200">
                  Register your roll number once. When your result is available
                  on the official university portal, we check it and send you a
                  WhatsApp result summary.
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
                  <p className="text-2xl font-black text-slate-950">
                    Official
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    University portal based
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-black text-slate-950">
                    WhatsApp
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Result summary alert
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-black text-slate-950">Fast</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Automatic checking
                  </p>
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-xl shadow-amber-900/10">
                <h2 className="text-xl font-black text-slate-950">
                  How it works
                </h2>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black">1. Register your details</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Select your exact course/semester and enter your roll
                      number.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black">2. We check the result</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      The system checks the official university result portal.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black">3. You get an update</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      When result is found, you receive a WhatsApp summary and
                      official result link.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] bg-amber-500 p-6 text-white shadow-xl shadow-amber-500/20">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-100">
                  Important
                </p>
                <h3 className="mt-2 text-2xl font-black">
                  Select exact course
                </h3>
                <p className="mt-3 text-sm leading-6 text-amber-50">
                  NEP, Annual, B.Ed and PG results may use different official
                  forms. Always select the exact course/semester shown on the
                  registration page.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
