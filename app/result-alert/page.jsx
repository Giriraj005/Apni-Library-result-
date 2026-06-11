"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_GROUPS = [
  {
    id: "pg_nep",
    label: "PG Semester",
    subtitle: "PG NEP, MBA, MCA, LLM, M.Com, M.Sc, M.A results",
    options: []
  },
  {
    id: "ug_nep",
    label: "UG Semester",
    subtitle: "BA, BSc, BCom, BBA, BCA semester results",
    options: []
  },
  {
    id: "pg_annual",
    label: "PG Annual",
    subtitle: "MA, MSc, MCom Previous / Final results",
    options: []
  },
  {
    id: "ug_annual",
    label: "UG Annual",
    subtitle: "BA, BSc, BCom, BBA, BCA Part results",
    options: []
  },
  {
    id: "bed_med",
    label: "B.Ed / M.Ed",
    subtitle: "B.Ed, M.Ed, BA B.Ed, BSc B.Ed results",
    options: []
  },
  {
    id: "credit_other",
    label: "Other",
    subtitle: "Credit based and other result forms",
    options: []
  }
];

function cls(...items) {
  return items.filter(Boolean).join(" ");
}

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function Icon({ name, className = "" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className
  };

  const icons = {
    bell: (
      <svg {...common}>
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      </svg>
    ),
    user: (
      <svg {...common}>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    hash: (
      <svg {...common}>
        <path d="M4 9h16" />
        <path d="M4 15h16" />
        <path d="M10 3 8 21" />
        <path d="m16 3-2 18" />
      </svg>
    ),
    phone: (
      <svg {...common}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.63 2.61a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6.27 6.27l1.29-1.29a2 2 0 0 1 2.11-.45c.84.3 1.71.51 2.61.63A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
    search: (
      <svg {...common}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
    chevron: (
      <svg {...common}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    ),
    shield: (
      <svg {...common}>
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    refresh: (
      <svg {...common}>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M3 21v-5h5" />
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    ),
    list: (
      <svg {...common}>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    ),
    lock: (
      <svg {...common}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    check: (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
    graduation: (
      <svg {...common}>
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c3 2 9 2 12 0v-5" />
      </svg>
    )
  };

  return icons[name] || null;
}

function FieldIcon({ name }) {
  return (
    <span className="pointer-events-none absolute left-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-slate-100">
      <Icon name={name} className="h-4.5 w-4.5" />
    </span>
  );
}

function StatCard({ number, icon, title, text }) {
  return (
    <div className="relative rounded-[1.35rem] border border-orange-100 bg-white/90 p-4 text-center shadow-[0_14px_35px_rgba(15,23,42,0.055)] backdrop-blur">
      <div className="mx-auto -mt-1 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-xs font-black text-white shadow-[0_12px_24px_rgba(249,115,22,0.28)]">
        {number}
      </div>
      <div className="mx-auto mt-4 grid h-12 w-12 place-items-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-600">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-black text-[#07112f]">{title}</h3>
      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{text}</p>
    </div>
  );
}

export default function ResultAlertPage() {
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  const [activeGroup, setActiveGroup] = useState("pg_nep");
  const [search, setSearch] = useState("");

  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [mobile, setMobile] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const [consentAdminPreview, setConsentAdminPreview] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        setOptionsError("");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const response = await fetch("/api/result-course-options", {
          cache: "no-store",
          signal: controller.signal
        });

        clearTimeout(timeout);

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Course options load nahi ho paye.");
        }

        if (!alive) return;

        const loadedGroups = Array.isArray(data.groups) ? data.groups : [];
        const filteredGroups = loadedGroups.filter((group) => group.id !== "all");
        const nextGroups = filteredGroups.length ? filteredGroups : DEFAULT_GROUPS;

        setGroups(nextGroups);

        const firstWithOptions =
          nextGroups.find(
            (group) => Array.isArray(group.options) && group.options.length
          ) || nextGroups[0];

        if (firstWithOptions?.id) {
          setActiveGroup(firstWithOptions.id);
        }
      } catch (err) {
        if (!alive) return;

        setOptionsError(
          err.name === "AbortError"
            ? "Course list slow hai. Page refresh karke dobara try karo."
            : err.message || "Course options load nahi ho paye."
        );

        setGroups(DEFAULT_GROUPS);
      } finally {
        if (alive) setLoadingOptions(false);
      }
    }

    loadOptions();

    return () => {
      alive = false;
    };
  }, []);

  const flatOptions = useMemo(() => {
    return groups.flatMap((group) =>
      (group.options || []).map((option) => ({
        ...option,
        groupId: group.id,
        groupLabel: group.label
      }))
    );
  }, [groups]);

  const activeOptions = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (term) {
      return flatOptions.filter((option) => {
        const hay = `${option.label || ""} ${option.yearPart || ""} ${
          option.groupLabel || ""
        }`.toLowerCase();

        return hay.includes(term);
      });
    }

    return flatOptions.filter((option) => option.groupId === activeGroup);
  }, [activeGroup, flatOptions, search]);

  const selectedOption = useMemo(() => {
    return flatOptions.find((option) => {
      const key = `${option.yearPart || option.label}__${option.formUrl || ""}`;
      return key === selectedValue;
    });
  }, [flatOptions, selectedValue]);

  const selectedGroup = useMemo(() => {
    return groups.find((group) => group.id === activeGroup);
  }, [groups, activeGroup]);

  async function handleSubmit(event) {
    event.preventDefault();

    setStatus(null);

    const cleanName = studentName.trim();
    const cleanRoll = rollNo.replace(/\s+/g, "").trim();
    const cleanMobile = normalizeMobile(mobile);

    if (!cleanName) {
      setStatus({ type: "error", message: "Student name required hai." });
      return;
    }

    if (!cleanRoll || cleanRoll.length < 3) {
      setStatus({ type: "error", message: "Valid roll number enter karo." });
      return;
    }

    if (!selectedOption) {
      setStatus({
        type: "error",
        message: "Course / result option select karo."
      });
      return;
    }

    if (!consentAdminPreview) {
      setStatus({
        type: "error",
        message: "Verification consent tick karna required hai."
      });
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/register-result-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: cleanName,
          rollNo: cleanRoll,
          mobile: cleanMobile,
          yearPart: selectedOption.yearPart || selectedOption.label,
          course: selectedOption.yearPart || selectedOption.label,
          resultType: "MAIN",
          formUrl: selectedOption.formUrl,
          formKey: selectedOption.formKey,
          consentAdminPreview: true
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Registration failed");
      }

      setStatus({
        type: "success",
        message:
          data.message ||
          "Registration successful. Result status page par update dikhega.",
        registrationId: data.registrationId,
        mobileVerifiedForWhatsApp: data.mobileVerifiedForWhatsApp
      });

      setStudentName("");
      setRollNo("");
      setMobile("");
      setSelectedValue("");
      setConsentAdminPreview(false);
    } catch (err) {
      setStatus({
        type: "error",
        message: err.message || "Registration failed"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fff7ed] px-3 py-3 text-slate-950 sm:px-5 sm:py-5 lg:px-7 lg:py-7">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-orange-200/40 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute -right-28 top-10 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <section className="mx-auto max-w-[1380px]">
        <div className="rounded-[1.6rem] border border-white/80 bg-white/90 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:rounded-[2rem] sm:p-5 lg:p-7">
          <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr] xl:grid-cols-[0.95fr_1.05fr]">
            <section className="order-2 rounded-[1.5rem] bg-gradient-to-br from-white via-[#fffaf3] to-white p-5 shadow-sm ring-1 ring-orange-100/60 sm:p-7 lg:order-1 lg:p-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-orange-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-orange-600 shadow-[0_10px_25px_rgba(249,115,22,0.12)]">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-50 text-orange-600">
                  <Icon name="bell" className="h-4 w-4" />
                </span>
                Result Alert
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_160px]">
                <div>
                  <h1 className="max-w-2xl text-[2.55rem] font-black leading-[1.08] tracking-[-0.055em] text-[#07112f] sm:text-5xl lg:text-[3.65rem] xl:text-[4.25rem]">
                    Result Alert ke liye{" "}
                    <span className="whitespace-nowrap">Roll Number</span>{" "}
                    <span className="relative inline-block text-orange-600">
                      Register Karo
                      <span className="absolute -bottom-1.5 left-0 h-2 w-full rounded-full bg-orange-200/90" />
                    </span>
                  </h1>

                  <p className="mt-5 max-w-xl text-sm font-medium leading-7 text-slate-600 sm:text-base sm:leading-8">
                    Register once to track your result status with ease. System
                    official portal se result check karega aur status page par
                    update show hoga.
                  </p>
                </div>

                <div className="relative hidden xl:block">
                  <div className="absolute right-0 top-0 rotate-6 rounded-[1.6rem] border border-orange-100 bg-white p-4 shadow-[0_22px_45px_rgba(15,23,42,0.10)]">
                    <div className="mb-3 h-3 w-20 rounded-full bg-orange-100" />
                    <div className="mb-4 h-3 w-28 rounded-full bg-slate-100" />
                    <div className="grid h-28 w-28 place-items-center rounded-[1.4rem] bg-gradient-to-br from-orange-100 to-amber-50 text-orange-600">
                      <Icon name="check" className="h-12 w-12" />
                    </div>
                  </div>
                  <div className="absolute -left-1 top-28 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-[0_18px_35px_rgba(249,115,22,0.30)]">
                    <Icon name="bell" className="h-8 w-8" />
                  </div>
                </div>
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-3">
                <StatCard
                  number="01"
                  icon="user"
                  title="Register"
                  text="Enter your details"
                />
                <StatCard
                  number="02"
                  icon="refresh"
                  title="Auto Check"
                  text="Official portal tracking"
                />
                <StatCard
                  number="03"
                  icon="shield"
                  title="Track Status"
                  text="Check latest status"
                />
              </div>

              <div className="mt-5 rounded-[1.45rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
                WhatsApp result/update sirf verified alert-list numbers par
                jayega. Baaki students status page se result status check kar
                sakte hain.
              </div>

              <div className="mt-4 rounded-[1.45rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                Same roll number + same course + same result type + same result
                year ek baar hi register hoga.
              </div>

              <div className="mt-5 hidden overflow-hidden rounded-[1.6rem] border border-orange-100 bg-gradient-to-br from-white via-[#fff7ed] to-[#ffe6cc] p-5 shadow-[0_18px_45px_rgba(249,115,22,0.10)] xl:block">
                <div className="grid gap-4 md:grid-cols-[1fr_210px]">
                  <div>
                    <h2 className="text-2xl font-black leading-tight tracking-tight text-[#07112f]">
                      Smart Result Tracking,{" "}
                      <span className="text-orange-600">Stay Updated.</span>
                    </h2>
                    <p className="mt-2 max-w-md text-sm font-medium leading-6 text-slate-600">
                      Secure registration, verified WhatsApp delivery, and status
                      page tracking for every student.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-yellow-100 text-yellow-600">
                            <Icon name="refresh" className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="text-sm font-black text-slate-900">
                              Auto Checks
                            </div>
                            <div className="text-xs text-slate-500">
                              Cron powered
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                            <Icon name="lock" className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="text-sm font-black text-slate-900">
                              Secure Status
                            </div>
                            <div className="text-xs text-slate-500">
                              Private access
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute right-4 top-0 rotate-6 rounded-[1.8rem] bg-gradient-to-br from-[#071a43] to-[#123c86] p-3 shadow-[0_25px_45px_rgba(15,23,42,0.26)]">
                      <div className="h-56 w-32 rounded-[1.35rem] border border-white/20 bg-[#071a43] p-3">
                        <div className="mx-auto mb-5 h-1.5 w-9 rounded-full bg-white/35" />
                        <div className="grid place-items-center pt-3 text-center">
                          <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-orange-400 text-white shadow-lg">
                            <Icon name="bell" className="h-7 w-7" />
                          </div>
                          <div className="text-base font-black leading-tight text-white">
                            Result Update
                            <br />
                            Available
                          </div>
                          <div className="mt-4 rounded-full bg-white px-3 py-2 text-[11px] font-black text-orange-600">
                            View Status
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-0 grid h-16 w-16 place-items-center rounded-3xl bg-[#10234c] text-white shadow-xl">
                      <Icon name="check" className="h-8 w-8" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs font-black text-slate-600 sm:text-sm">
                <span className="flex items-center gap-2">
                  <Icon name="shield" className="h-4 w-4 text-indigo-700" />
                  Secure
                </span>
                <span className="text-slate-300">•</span>
                <span>Private</span>
                <span className="text-slate-300">•</span>
                <span>Verified Alerts Only</span>
              </div>
            </section>

            <section className="order-1 lg:order-2">
              <form
                onSubmit={handleSubmit}
                className="rounded-[1.7rem] bg-gradient-to-br from-orange-100 via-white to-indigo-100 p-[2px] shadow-[0_28px_75px_rgba(15,23,42,0.12)]"
              >
                <div className="relative rounded-[1.6rem] bg-white/95 p-5 backdrop-blur sm:p-7 lg:p-8">
                  <div className="pointer-events-none absolute right-7 top-7 text-orange-300">
                    ✦
                  </div>
                  <div className="pointer-events-none absolute right-12 top-14 text-amber-300">
                    ✦
                  </div>

                  <div className="mb-6 flex items-start gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#062b69] to-[#06163e] text-white shadow-[0_18px_35px_rgba(8,21,66,0.25)] sm:h-20 sm:w-20">
                      <Icon name="graduation" className="h-8 w-8 sm:h-10 sm:w-10" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black tracking-tight text-[#07112f] sm:text-4xl">
                        Register Details
                      </h2>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-600 sm:text-base">
                        Enter details and track result status securely.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-black text-slate-900">
                          Student Name
                        </span>
                        <div className="relative">
                          <FieldIcon name="user" />
                          <input
                            value={studentName}
                            onChange={(event) =>
                              setStudentName(event.target.value)
                            }
                            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-16 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 sm:h-16 sm:text-base"
                            placeholder="Enter your name"
                          />
                        </div>
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-black text-slate-900">
                          Roll Number
                        </span>
                        <div className="relative">
                          <FieldIcon name="hash" />
                          <input
                            value={rollNo}
                            onChange={(event) => setRollNo(event.target.value)}
                            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-16 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 sm:h-16 sm:text-base"
                            placeholder="Enter roll number"
                          />
                        </div>
                      </label>
                    </div>

                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-900">
                        WhatsApp / Mobile Number
                      </span>
                      <div className="relative">
                        <FieldIcon name="phone" />
                        <input
                          value={mobile}
                          onChange={(event) => setMobile(event.target.value)}
                          className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-16 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 sm:h-16 sm:text-base"
                          placeholder="Enter mobile number"
                        />
                      </div>

                      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
                        WhatsApp result/update sirf verified alert-list numbers
                        par jayega. Status page sab students ke liye available
                        rahega.
                      </div>
                    </label>

                    <div className="grid gap-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-950">
                          Course / Result Option
                        </h3>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                          {selectedGroup?.subtitle ||
                            "Select exact course from official result options"}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {groups.map((group) => {
                          const isActive = activeGroup === group.id;
                          const count = group.options?.length || 0;

                          return (
                            <button
                              key={group.id}
                              type="button"
                              onClick={() => {
                                setActiveGroup(group.id);
                                setSearch("");
                                setSelectedValue("");
                              }}
                              className={cls(
                                "flex min-h-[3.25rem] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-black transition",
                                isActive
                                  ? "border-[#071a43] bg-[#071a43] text-white shadow-[0_10px_24px_rgba(7,26,67,0.20)]"
                                  : "border-slate-200 bg-white text-[#1b2559] hover:border-orange-200 hover:bg-orange-50"
                              )}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className={cls(
                                    "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                                    isActive
                                      ? "bg-white text-orange-600"
                                      : "bg-orange-50 text-orange-600"
                                  )}
                                >
                                  <Icon name="check" className="h-3.5 w-3.5" />
                                </span>
                                <span className="line-clamp-2">{group.label}</span>
                              </span>

                              <span
                                className={cls(
                                  "shrink-0 rounded-full px-3 py-1 text-xs font-black",
                                  isActive
                                    ? "bg-orange-500 text-white"
                                    : count
                                    ? "bg-indigo-50 text-indigo-700"
                                    : "bg-slate-100 text-slate-400"
                                )}
                              >
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="relative">
                        <FieldIcon name="search" />
                        <input
                          value={search}
                          onChange={(event) => {
                            setSearch(event.target.value);
                            setSelectedValue("");
                          }}
                          className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-16 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 sm:h-16 sm:text-base"
                          placeholder="Search: M.COM, BSC, B.A, B.ED..."
                        />
                      </div>

                      <div className="relative">
                        <FieldIcon name="list" />
                        <select
                          value={selectedValue}
                          onChange={(event) =>
                            setSelectedValue(event.target.value)
                          }
                          className="h-14 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-16 pr-12 text-sm font-black text-[#1b2559] outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100 sm:h-16 sm:text-base"
                          disabled={loadingOptions}
                        >
                          <option value="">
                            {loadingOptions
                              ? "Loading options..."
                              : activeOptions.length
                              ? "Select course / result option"
                              : "No option found"}
                          </option>

                          {activeOptions.map((option, index) => {
                            const key = `${option.yearPart || option.label}__${
                              option.formUrl || ""
                            }`;

                            return (
                              <option key={`${key}_${index}`} value={key}>
                                {option.label || option.yearPart}
                              </option>
                            );
                          })}
                        </select>

                        <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#1b2559]">
                          <Icon name="chevron" className="h-5 w-5" />
                        </span>
                      </div>

                      {loadingOptions ? (
                        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3 text-xs font-bold text-orange-800">
                          Official result options load ho rahe hain...
                        </div>
                      ) : null}

                      {optionsError ? (
                        <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">
                          {optionsError}
                        </div>
                      ) : null}

                      {selectedOption ? (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                          <b>Selected:</b>{" "}
                          {selectedOption.yearPart || selectedOption.label}
                        </div>
                      ) : null}
                    </div>

                    <label className="flex items-start gap-4 rounded-2xl border border-orange-100 bg-orange-50/70 p-4 text-sm font-semibold leading-6 text-slate-700 sm:p-5">
                      <input
                        type="checkbox"
                        checked={consentAdminPreview}
                        onChange={(event) =>
                          setConsentAdminPreview(event.target.checked)
                        }
                        className="mt-1 h-5 w-5 rounded border-orange-300 accent-orange-500"
                      />
                      <span>
                        I agree that Apni Library admin team can receive my
                        result preview for verification.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={submitting || loadingOptions}
                      className="group relative h-14 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 px-6 text-base font-black text-white shadow-[0_18px_35px_rgba(249,115,22,0.30)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 sm:h-16 sm:text-lg"
                    >
                      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition duration-700 group-hover:translate-x-full" />
                      <span className="relative inline-flex items-center justify-center gap-3">
                        <Icon name="bell" className="h-5 w-5" />
                        {submitting ? "Registering..." : "Register Result Alert"}
                      </span>
                    </button>

                    {status ? (
                      <div
                        className={cls(
                          "rounded-2xl p-4 text-sm font-bold leading-6 sm:p-5",
                          status.type === "success"
                            ? "border border-emerald-100 bg-emerald-50 text-emerald-800"
                            : "border border-red-100 bg-red-50 text-red-700"
                        )}
                      >
                        {status.message}

                        {status.type === "success" ? (
                          <div className="mt-4 flex flex-wrap gap-3">
                            <a
                              href="/result-status"
                              className="inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-black text-slate-900 ring-1 ring-slate-200"
                            >
                              Check Status
                            </a>
                            <a
                              href="/"
                              className="inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-black text-slate-900 ring-1 ring-slate-200"
                            >
                              Go Home
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                      <Icon name="lock" className="h-3.5 w-3.5" />
                      Your details are secure and used only for result tracking.
                    </div>
                  </div>
                </div>
              </form>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
          }
