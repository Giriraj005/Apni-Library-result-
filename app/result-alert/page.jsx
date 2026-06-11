"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_GROUPS = [
  {
    id: "pg_nep",
    label: "PG / Semester / NEP",
    subtitle: "PG NEP, MBA, MCA, LLM, M.Com, M.Sc, M.A results",
    options: []
  },
  {
    id: "ug_nep",
    label: "UG NEP Semester",
    subtitle: "BA, BSc, BCom, BBA, BCA semester results",
    options: []
  },
  {
    id: "pg_annual",
    label: "PG Annual / Final / Previous",
    subtitle: "MA, MSc, MCom Previous / Final results",
    options: []
  },
  {
    id: "ug_annual",
    label: "UG Annual / Old Scheme",
    subtitle: "BA, BSc, BCom, BBA, BCA Part results",
    options: []
  },
  {
    id: "bed_med",
    label: "B.Ed / M.Ed / Integrated",
    subtitle: "B.Ed, M.Ed, BA B.Ed, BSc B.Ed results",
    options: []
  },
  {
    id: "credit_other",
    label: "Credit / Other Results",
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

function GroupIcon({ active }) {
  return (
    <span
      className={cls(
        "grid h-7 w-7 place-items-center rounded-full text-[11px] font-black transition",
        active
          ? "bg-white text-orange-600"
          : "bg-orange-50 text-orange-600"
      )}
    >
      ✓
    </span>
  );
}

function InputIcon({ children }) {
  return (
    <span className="pointer-events-none absolute left-4 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-xl bg-slate-50 text-slate-500">
      {children}
    </span>
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
  const [consentAdminPreview, setConsentAdminPreview] = useState(true);

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
      setStatus({
        type: "error",
        message: "Student name required hai."
      });
      return;
    }

    if (!cleanRoll || cleanRoll.length < 3) {
      setStatus({
        type: "error",
        message: "Valid roll number enter karo."
      });
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
        headers: {
          "Content-Type": "application/json"
        },
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
      setConsentAdminPreview(true);
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
    <main className="min-h-screen overflow-hidden bg-[#fff7ed] px-3 py-4 text-slate-950 sm:px-5 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-140px] top-[-120px] h-96 w-96 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute right-[-160px] top-20 h-[28rem] w-[28rem] rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute bottom-[-140px] left-1/3 h-96 w-96 rounded-full bg-amber-200/35 blur-3xl" />
      </div>

      <section className="mx-auto max-w-[1500px]">
        <div className="relative overflow-hidden rounded-[2.2rem] border border-white/80 bg-white/90 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-6 lg:p-8">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent" />

          <div className="grid gap-8 xl:grid-cols-[0.97fr_1.03fr]">
            <section className="relative overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-white via-[#fffaf3] to-white p-5 sm:p-7 lg:p-9">
              <div className="absolute right-5 top-8 hidden h-32 w-32 rounded-full bg-orange-100 blur-3xl lg:block" />
              <div className="absolute bottom-8 left-8 hidden h-36 w-36 rounded-full bg-amber-100 blur-3xl lg:block" />

              <div className="relative">
                <div className="inline-flex items-center gap-3 rounded-full border border-orange-100 bg-white px-5 py-3 text-sm font-black uppercase tracking-wide text-orange-600 shadow-[0_10px_28px_rgba(249,115,22,0.12)]">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-50 text-base">
                    🔔
                  </span>
                  Result Alert
                </div>

                <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_auto]">
                  <div>
                    <h1 className="max-w-3xl text-[2.75rem] font-black leading-[1.08] tracking-[-0.055em] text-[#070d24] sm:text-6xl lg:text-[4.65rem]">
                      Result alert ke liye roll number{" "}
                      <span className="relative inline-block text-orange-600">
                        register karo
                        <span className="absolute -bottom-2 left-0 h-3 w-full rounded-full bg-orange-200/80" />
                      </span>
                    </h1>

                    <p className="mt-7 max-w-2xl text-lg font-medium leading-9 text-slate-600">
                      Register once to track your result status with ease.
                      System official portal se result check karega aur status
                      page par update show hoga.
                    </p>
                  </div>

                  <div className="relative hidden w-40 shrink-0 lg:block">
                    <div className="absolute right-0 top-0 rotate-6 rounded-3xl border border-orange-100 bg-white p-5 shadow-[0_22px_45px_rgba(15,23,42,0.10)]">
                      <div className="mb-3 h-3 w-20 rounded-full bg-orange-100" />
                      <div className="mb-3 h-3 w-28 rounded-full bg-slate-100" />
                      <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-orange-200 to-amber-50 p-4">
                        <div className="grid h-full w-full place-items-center rounded-2xl bg-white text-4xl shadow-inner">
                          ✓
                        </div>
                      </div>
                    </div>
                    <div className="absolute -left-4 top-28 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-4xl shadow-[0_18px_35px_rgba(249,115,22,0.30)]">
                      🔔
                    </div>
                  </div>
                </div>

                <div className="mt-9 grid gap-5 md:grid-cols-3">
                  {[
                    {
                      n: "01",
                      icon: "👤",
                      title: "Register",
                      text: "Enter your details"
                    },
                    {
                      n: "02",
                      icon: "🔄",
                      title: "Auto Check",
                      text: "Official portal tracking"
                    },
                    {
                      n: "03",
                      icon: "🛡️",
                      title: "Track Status",
                      text: "Check latest status"
                    }
                  ].map((item, index) => (
                    <div
                      key={item.n}
                      className="relative rounded-[1.5rem] border border-orange-100 bg-white p-5 text-center shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
                    >
                      {index < 2 ? (
                        <div className="absolute -right-5 top-1/2 hidden h-px w-10 border-t border-dashed border-orange-200 md:block" />
                      ) : null}

                      <div className="mx-auto -mt-1 grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-sm font-black text-white shadow-[0_12px_25px_rgba(249,115,22,0.30)]">
                        {item.n}
                      </div>

                      <div className="mx-auto mt-5 grid h-14 w-14 place-items-center rounded-2xl border border-orange-100 bg-orange-50 text-3xl">
                        {item.icon}
                      </div>

                      <h3 className="mt-4 text-lg font-black text-[#07112f]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 overflow-hidden rounded-[1.6rem] border border-orange-100 bg-gradient-to-br from-white via-[#fff7ed] to-[#ffe7cf] p-5 shadow-[0_18px_50px_rgba(249,115,22,0.10)]">
                  <div className="grid gap-5 md:grid-cols-[1fr_240px]">
                    <div>
                      <h2 className="text-3xl font-black leading-tight tracking-tight text-[#08112d]">
                        Smart Result Alerts,{" "}
                        <span className="text-orange-600">Stay Informed.</span>
                      </h2>
                      <p className="mt-3 max-w-md text-base font-medium leading-7 text-slate-600">
                        Verified delivery, secure tracking and clean student
                        status experience.
                      </p>

                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-yellow-100 text-xl">
                              ⚡
                            </span>
                            <div>
                              <div className="text-sm font-black text-slate-900">
                                Quick Updates
                              </div>
                              <div className="text-xs text-slate-500">
                                Automatic cron checks
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100 text-xl">
                              🔒
                            </span>
                            <div>
                              <div className="text-sm font-black text-slate-900">
                                Secure Access
                              </div>
                              <div className="text-xs text-slate-500">
                                Status page tracking
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="relative hidden md:block">
                      <div className="absolute right-3 top-0 rotate-6 rounded-[2rem] bg-gradient-to-br from-[#05183f] to-[#153c83] p-4 shadow-[0_25px_45px_rgba(15,23,42,0.30)]">
                        <div className="h-64 w-36 rounded-[1.5rem] border border-white/20 bg-[#071a43] p-3">
                          <div className="mx-auto mb-7 h-1.5 w-10 rounded-full bg-white/35" />
                          <div className="grid place-items-center pt-4 text-center">
                            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-orange-400 text-4xl shadow-lg">
                              🔔
                            </div>
                            <div className="text-lg font-black leading-tight text-white">
                              Result Update
                              <br />
                              Available
                            </div>
                            <div className="mt-5 rounded-full bg-white px-4 py-2 text-xs font-black text-orange-600">
                              View Result
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-4 left-2 grid h-20 w-20 place-items-center rounded-3xl bg-[#10234c] text-4xl text-white shadow-xl">
                        ✓
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm font-black text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="text-lg">🛡️</span> Secure
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>Private</span>
                  <span className="text-slate-300">•</span>
                  <span>Verified Alerts Only</span>
                </div>
              </div>
            </section>

            <section className="relative rounded-[1.9rem] bg-gradient-to-br from-orange-100 via-white to-indigo-100 p-[2px] shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
              <form
                onSubmit={handleSubmit}
                className="relative h-full rounded-[1.8rem] bg-white/92 p-5 shadow-inner backdrop-blur sm:p-7 lg:p-8"
              >
                <div className="pointer-events-none absolute right-8 top-8 text-3xl">
                  ✨
                </div>
                <div className="pointer-events-none absolute right-16 top-20 text-xl">
                  ⭐
                </div>

                <div className="mb-7 flex items-start gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#062b69] to-[#06163e] text-4xl text-white shadow-[0_18px_35px_rgba(8,21,66,0.25)]">
                    🎓
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-[#07112f] sm:text-4xl">
                      Register Details
                    </h2>
                    <p className="mt-2 text-base font-medium text-slate-600">
                      Enter your details and track result status securely.
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
                        <InputIcon>👤</InputIcon>
                        <input
                          value={studentName}
                          onChange={(event) =>
                            setStudentName(event.target.value)
                          }
                          className="h-16 w-full rounded-2xl border border-slate-200 bg-white pl-14 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                          placeholder="Enter your name"
                        />
                      </div>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-black text-slate-900">
                        Roll Number
                      </span>
                      <div className="relative">
                        <InputIcon>#</InputIcon>
                        <input
                          value={rollNo}
                          onChange={(event) => setRollNo(event.target.value)}
                          className="h-16 w-full rounded-2xl border border-slate-200 bg-white pl-14 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
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
                      <InputIcon>☏</InputIcon>
                      <input
                        value={mobile}
                        onChange={(event) => setMobile(event.target.value)}
                        className="h-16 w-full rounded-2xl border border-slate-200 bg-white pl-14 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                        placeholder="Enter mobile number"
                      />
                    </div>
                    <p className="text-xs font-semibold leading-5 text-slate-500">
                      WhatsApp result/update sirf verified alert list numbers par
                      jayega.
                    </p>
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
                              "flex min-h-[3.4rem] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-black transition",
                              isActive
                                ? "border-orange-500 bg-gradient-to-r from-[#071a43] to-[#0e2b61] text-white shadow-[0_12px_26px_rgba(249,115,22,0.24)] ring-2 ring-orange-300"
                                : "border-slate-200 bg-white text-[#1b2559] hover:border-orange-200 hover:bg-orange-50"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <GroupIcon active={isActive} />
                              <span>{group.label}</span>
                            </span>

                            <span
                              className={cls(
                                "rounded-full px-3 py-1 text-xs font-black",
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
                      <InputIcon>🔍</InputIcon>
                      <input
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setSelectedValue("");
                        }}
                        className="h-16 w-full rounded-2xl border border-slate-200 bg-white pl-14 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                        placeholder="Search: M.COM, BSC, B.A, B.ED..."
                      />
                    </div>

                    <div className="relative">
                      <InputIcon>▰</InputIcon>
                      <select
                        value={selectedValue}
                        onChange={(event) =>
                          setSelectedValue(event.target.value)
                        }
                        className="h-16 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-14 pr-12 text-base font-black text-[#1b2559] outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
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

                      <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl text-[#1b2559]">
                        ⌄
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

                  <label className="flex items-start gap-4 rounded-2xl border border-orange-100 bg-orange-50/70 p-5 text-sm font-semibold leading-6 text-slate-700">
                    <input
                      type="checkbox"
                      checked={consentAdminPreview}
                      onChange={(event) =>
                        setConsentAdminPreview(event.target.checked)
                      }
                      className="mt-1 h-5 w-5 rounded border-orange-300 accent-orange-500"
                    />
                    <span>
                      I agree that Apni Library admin team may receive result
                      preview for verification and alert processing.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting || loadingOptions}
                    className="group relative h-16 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 px-6 text-lg font-black text-white shadow-[0_18px_35px_rgba(249,115,22,0.30)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition duration-700 group-hover:translate-x-full" />
                    <span className="relative inline-flex items-center justify-center gap-3">
                      <span className="text-xl">🔔</span>
                      {submitting ? "Registering..." : "Register Result Alert"}
                    </span>
                  </button>

                  {status ? (
                    <div
                      className={cls(
                        "rounded-2xl p-5 text-sm font-bold leading-6",
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
                    <span>🔒</span>
                    We respect your privacy. Your details are safe with us.
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
