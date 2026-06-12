"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_GROUPS = [
  {
    id: "pg_nep",
    label: "PG / Semester / NEP",
    subtitle: "Select the result category that matches your course.",
    options: []
  },
  {
    id: "ug_nep",
    label: "UG NEP Semester",
    subtitle: "Select the result category that matches your course.",
    options: []
  },
  {
    id: "pg_annual",
    label: "PG Annual / Final / Previous",
    subtitle: "Select the result category that matches your course.",
    options: []
  },
  {
    id: "ug_annual",
    label: "UG Annual / Old Scheme",
    subtitle: "Select the result category that matches your course.",
    options: []
  },
  {
    id: "bed_med",
    label: "B.Ed / M.Ed / Integrated",
    subtitle: "Select the result category that matches your course.",
    options: []
  },
  {
    id: "credit_other",
    label: "Credit / Other Results",
    subtitle: "Select the result category that matches your course.",
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
    ),
    bolt: (
      <svg {...common}>
        <path d="M13 2 3 14h8l-1 8 11-14h-8l0-6Z" />
      </svg>
    ),
    sparkles: (
      <svg {...common}>
        <path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15l-1.6-4.2L6 9.2l4.4-1.6L12 3Z" />
        <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
        <path d="M5 14l.7 2L8 17l-2.3.9L5 20l-.7-2.1L2 17l2.3-1L5 14Z" />
      </svg>
    )
  };

  return icons[name] || null;
}

function FieldIcon({ name }) {
  return (
    <span className="pointer-events-none absolute left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-slate-100">
      <Icon name={name} className="h-5 w-5" />
    </span>
  );
}

function StepCard({ number, icon, title, subtitle, showConnector }) {
  return (
    <div className="relative rounded-[1.35rem] border border-orange-100 bg-white/95 p-4 text-center shadow-[0_16px_36px_rgba(15,23,42,0.055)]">
      {showConnector ? (
        <div className="absolute -right-5 top-1/2 hidden h-px w-10 border-t border-dashed border-orange-200 md:block" />
      ) : null}

      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-xs font-black text-white shadow-[0_12px_24px_rgba(249,115,22,0.30)]">
        {number}
      </div>

      <div className="mx-auto mt-4 grid h-12 w-12 place-items-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-600">
        <Icon name={icon} className="h-6 w-6" />
      </div>

      <h3 className="mt-3 text-base font-black text-[#07122f]">{title}</h3>
      <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500 sm:text-sm">
        {subtitle}
      </p>
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
            ? "Course list is taking longer than expected. Please refresh and try again."
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
        message: "Consent tick karna required hai."
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
    <main className="min-h-screen overflow-hidden bg-[#f7f3ec] px-3 py-4 text-slate-950 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-24 -top-28 h-80 w-80 rounded-full bg-orange-200/40 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute -right-28 top-10 h-96 w-96 rounded-full bg-blue-200/25 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-200/25 blur-3xl" />
      </div>

      <section className="mx-auto max-w-[1360px]">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/92 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:rounded-[2rem] sm:p-5 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[56fr_44fr] lg:items-start">
            <section className="relative rounded-[1.5rem] bg-gradient-to-br from-white via-[#fffaf4] to-white p-5 shadow-sm ring-1 ring-orange-100/70 sm:p-7 lg:p-8 xl:p-10">
              <div className="pointer-events-none absolute right-6 top-8 hidden h-28 w-28 rounded-full bg-orange-100/70 blur-3xl md:block" />
              <div className="pointer-events-none absolute bottom-12 left-8 hidden h-32 w-32 rounded-full bg-amber-100/70 blur-3xl md:block" />

              <div className="relative">
                <div className="inline-flex items-center gap-3 rounded-full border border-orange-100 bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-orange-600 shadow-[0_10px_25px_rgba(249,115,22,0.12)]">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-50 text-orange-600">
                    <Icon name="bell" className="h-4 w-4" />
                  </span>
                  RESULT ALERT
                </div>

                <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_170px]">
                  <div>
                    <h1 className="max-w-[820px] text-[2.7rem] font-black leading-[1.08] tracking-[-0.055em] text-[#07122f] sm:text-5xl lg:text-[3.85rem] xl:text-[4.4rem]">
                      <span className="block">Result alert ke liye</span>
                      <span className="block">
                        roll number{" "}
                        <span className="relative inline-block whitespace-nowrap text-orange-600">
                          register karo
                          <span className="absolute -bottom-1.5 left-0 h-2 w-full rounded-full bg-orange-200/90" />
                        </span>
                      </span>
                    </h1>

                    <p className="mt-6 max-w-[700px] text-base font-medium leading-8 text-slate-600 sm:text-lg">
                      Register once to receive timely result updates and track
                      your status with ease. Stay informed with a simple and
                      secure alert experience.
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

                    <div className="absolute -left-2 top-28 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-[0_18px_35px_rgba(249,115,22,0.30)]">
                      <Icon name="bell" className="h-8 w-8" />
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  <StepCard
                    number="01"
                    icon="user"
                    title="Register"
                    subtitle="Enter your details"
                    showConnector
                  />
                  <StepCard
                    number="02"
                    icon="bell"
                    title="Get Alerts"
                    subtitle="Receive timely updates"
                    showConnector
                  />
                  <StepCard
                    number="03"
                    icon="shield"
                    title="Track Status"
                    subtitle="Check latest status"
                  />
                </div>

                <div className="mt-6 overflow-hidden rounded-[1.65rem] border border-orange-100 bg-gradient-to-br from-white via-[#fff7ed] to-[#ffe4c7] p-5 shadow-[0_18px_45px_rgba(249,115,22,0.10)] sm:p-6">
                  <div className="grid gap-5 md:grid-cols-[1fr_245px] md:items-center">
                    <div>
                      <h2 className="text-2xl font-black leading-tight tracking-tight text-[#07122f] sm:text-3xl">
                        Smart Result Alerts,
                        <br />
                        <span className="text-orange-600">Stay Informed.</span>
                      </h2>

                      <p className="mt-3 max-w-md text-sm font-medium leading-6 text-slate-600 sm:text-base">
                        Timely updates. Complete peace of mind.
                      </p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-orange-100/60">
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-yellow-100 text-yellow-600">
                              <Icon name="bolt" className="h-5 w-5" />
                            </span>
                            <div>
                              <div className="text-sm font-black text-slate-900">
                                Quick Updates
                              </div>
                              <div className="text-xs text-slate-500">
                                Timely notifications
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-orange-100/60">
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100 text-purple-600">
                              <Icon name="lock" className="h-5 w-5" />
                            </span>
                            <div>
                              <div className="text-sm font-black text-slate-900">
                                Secure Access
                              </div>
                              <div className="text-xs text-slate-500">
                                Your data is protected
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative mx-auto hidden h-56 w-56 md:block">
                      <div className="absolute right-8 top-0 rotate-6 rounded-[1.8rem] bg-gradient-to-br from-[#071a43] to-[#123c86] p-3 shadow-[0_25px_45px_rgba(15,23,42,0.26)]">
                        <div className="h-48 w-28 rounded-[1.35rem] border border-white/20 bg-[#071a43] p-3">
                          <div className="mx-auto mb-4 h-1.5 w-8 rounded-full bg-white/35" />
                          <div className="grid place-items-center pt-2 text-center">
                            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-orange-400 text-white shadow-lg">
                              <Icon name="bell" className="h-6 w-6" />
                            </div>
                            <div className="text-sm font-black leading-tight text-white">
                              Result Update
                              <br />
                              Available
                            </div>
                            <div className="mt-4 rounded-full bg-white px-3 py-2 text-[10px] font-black text-orange-600">
                              View Result
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="absolute bottom-4 left-4 grid h-16 w-16 place-items-center rounded-3xl bg-[#10234c] text-white shadow-xl">
                        <Icon name="check" className="h-8 w-8" />
                      </div>

                      <div className="absolute right-1 top-12 text-orange-400">
                        <Icon name="sparkles" className="h-8 w-8" />
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
              </div>
            </section>

            <section className="lg:self-start">
              <form
                onSubmit={handleSubmit}
                className="rounded-[1.7rem] bg-gradient-to-br from-orange-100 via-white to-blue-100 p-[2px] shadow-[0_28px_75px_rgba(15,23,42,0.12)]"
              >
                <div className="relative rounded-[1.6rem] bg-white/95 backdrop-blur">
                  <div className="overflow-hidden rounded-t-[1.6rem] bg-gradient-to-br from-orange-100 via-white to-blue-100 px-5 py-6 sm:px-7 sm:py-7">
                    <div className="pointer-events-none absolute right-7 top-7 text-orange-300">
                      <Icon name="sparkles" className="h-7 w-7" />
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#062b69] to-[#06163e] text-white shadow-[0_18px_35px_rgba(8,21,66,0.25)] sm:h-20 sm:w-20">
                        <Icon
                          name="graduation"
                          className="h-8 w-8 sm:h-10 sm:w-10"
                        />
                      </div>

                      <div>
                        <h2 className="text-3xl font-black tracking-tight text-[#07122f] sm:text-4xl">
                          Register Details
                        </h2>
                        <p className="mt-2 text-sm font-medium leading-6 text-slate-600 sm:text-base">
                          Enter your details and get result alerts.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-5 sm:px-7 sm:py-6">
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
                              onChange={(event) =>
                                setRollNo(event.target.value)
                              }
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
                      </label>

                      <div className="grid gap-3">
                        <div>
                          <h3 className="text-lg font-black text-slate-950">
                            Course / Result Option
                          </h3>
                          <p className="mt-1 text-sm font-medium text-slate-500">
                            Select the result category that matches your course.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
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
                                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-left text-xs font-black transition sm:text-sm",
                                  isActive
                                    ? "border-[#071a43] bg-[#071a43] text-white shadow-[0_10px_22px_rgba(7,26,67,0.18)]"
                                    : "border-slate-200 bg-white text-[#1b2559] hover:border-orange-200 hover:bg-orange-50"
                                )}
                              >
                                <span>{group.label}</span>

                                <span
                                  className={cls(
                                    "rounded-full px-2.5 py-1 text-[11px] font-black",
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
                              const key = `${
                                option.yearPart || option.label
                              }__${option.formUrl || ""}`;

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
                            Loading course options...
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
                          I agree to receive result alerts and important updates.
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
                          {submitting
                            ? "Registering..."
                            : "Register Result Alert"}
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

                      <div className="flex items-center justify-center gap-2 text-center text-xs font-bold text-slate-500">
                        <Icon name="lock" className="h-3.5 w-3.5" />
                        We respect your privacy. Your details are safe with us.
                      </div>
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
