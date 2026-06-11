"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_GROUPS = [
  {
    id: "pg_nep",
    label: "PG Semester",
    subtitle: "PG NEP, MBA, MCA, LLM, M.Com, M.Sc, M.A",
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
    subtitle: "MA, MSc, MCom Previous / Final",
    options: []
  },
  {
    id: "ug_annual",
    label: "UG Annual",
    subtitle: "BA, BSc, BCom Part-II / Part-III",
    options: []
  },
  {
    id: "bed_med",
    label: "B.Ed / M.Ed",
    subtitle: "B.Ed, M.Ed, BA B.Ed, BSc B.Ed",
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

        const res = await fetch("/api/result-course-options", {
          cache: "no-store",
          signal: controller.signal
        });

        clearTimeout(timeout);

        const data = await res.json();

        if (!res.ok || !data.success) {
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
        message: "Verification consent tick karna required hai."
      });
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch("/api/register-result-alert", {
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

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
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
    <main className="min-h-screen bg-[#f7f3ec] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[2rem] border border-[#eadfce] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative bg-gradient-to-br from-[#fff7ed] via-white to-[#f8fafc] p-6 sm:p-8 lg:p-10">
              <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full bg-orange-100 blur-2xl sm:block" />
              <div className="absolute bottom-10 left-8 hidden h-24 w-24 rounded-full bg-amber-100 blur-2xl sm:block" />

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-orange-700 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  PDUSU Result Alert
                </div>

                <h1 className="mt-6 max-w-xl text-3xl font-black leading-[1.05] tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                  Result alert ke liye roll number register karo
                </h1>

                <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                  Result available hote hi system official portal se status check
                  karega. Admin team ko verification preview milega, aur student
                  status page par result update dekh sakta hai.
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {[
                    ["01", "Register", "Course aur roll number save hoga"],
                    ["02", "Auto Check", "Cron result portal check karega"],
                    ["03", "Status", "Status page par update dikhega"]
                  ].map((item) => (
                    <div
                      key={item[0]}
                      className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm ring-1 ring-slate-100"
                    >
                      <div className="text-lg font-black text-orange-600">
                        {item[0]}
                      </div>
                      <div className="mt-2 text-sm font-black text-slate-950">
                        {item[1]}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item[2]}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-7 space-y-3">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    WhatsApp result/update sirf verified alert list ke numbers
                    par jayega. Baaki students status page se result status check
                    kar sakte hain.
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                    Duplicate rule: same roll number + same course + same result
                    type + same result year ek baar hi register hoga.
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#fbfaf8] p-4 sm:p-6 lg:p-8">
              <form
                onSubmit={handleSubmit}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
              >
                <div className="mb-5">
                  <h2 className="text-xl font-black text-slate-950">
                    Register Details
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Course exact select karo, roll number carefully enter karo.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-slate-800">
                        Student Name
                      </span>
                      <input
                        value={studentName}
                        onChange={(event) =>
                          setStudentName(event.target.value)
                        }
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                        placeholder="Student name"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm font-bold text-slate-800">
                        Roll Number
                      </span>
                      <input
                        value={rollNo}
                        onChange={(event) => setRollNo(event.target.value)}
                        className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                        placeholder="Example: 26331464"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      WhatsApp / Mobile Number
                    </span>
                    <input
                      value={mobile}
                      onChange={(event) => setMobile(event.target.value)}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                      placeholder="Example: 9358282738"
                    />
                    <span className="text-xs leading-5 text-slate-500">
                      WhatsApp result/update sirf verified alert list numbers par
                      jayega.
                    </span>
                  </label>

                  <div className="grid gap-3">
                    <div>
                      <span className="text-sm font-bold text-slate-800">
                        Course / Result Option
                      </span>
                      {selectedGroup?.subtitle ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {selectedGroup.subtitle}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {groups.map((group) => {
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
                              "rounded-full px-3 py-2 text-xs font-black transition",
                              activeGroup === group.id
                                ? "bg-slate-950 text-white shadow-sm"
                                : "border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50"
                            )}
                          >
                            {group.label}
                            {count ? (
                              <span
                                className={cls(
                                  "ml-1 rounded-full px-1.5 py-0.5 text-[10px]",
                                  activeGroup === group.id
                                    ? "bg-white/15 text-white"
                                    : "bg-slate-100 text-slate-500"
                                )}
                              >
                                {count}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setSelectedValue("");
                      }}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                      placeholder="Search: M.COM ABST, B.A, B.SC, B.ED..."
                    />

                    <select
                      value={selectedValue}
                      onChange={(event) => setSelectedValue(event.target.value)}
                      className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
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

                    {loadingOptions ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                        Official result options load ho rahe hain...
                      </div>
                    ) : null}

                    {optionsError ? (
                      <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-700">
                        {optionsError}
                      </div>
                    ) : null}

                    {selectedOption ? (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                        <b>Selected:</b>{" "}
                        {selectedOption.yearPart || selectedOption.label}
                      </div>
                    ) : null}
                  </div>

                  <label className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    <input
                      type="checkbox"
                      checked={consentAdminPreview}
                      onChange={(event) =>
                        setConsentAdminPreview(event.target.checked)
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      Main agree karta/karti hoon ki result available hone par
                      Apni Library admin team verification ke liye result preview
                      receive kar sakti hai.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting || loadingOptions}
                    className="h-13 rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Registering..." : "Register Result Alert"}
                  </button>

                  {status ? (
                    <div
                      className={cls(
                        "rounded-2xl p-4 text-sm font-semibold leading-6",
                        status.type === "success"
                          ? "border border-emerald-100 bg-emerald-50 text-emerald-800"
                          : "border border-red-100 bg-red-50 text-red-700"
                      )}
                    >
                      {status.message}

                      {status.type === "success" ? (
                        <div className="mt-3">
                          <a
                            href="/result-status"
                            className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-black text-slate-900 ring-1 ring-slate-200"
                          >
                            Check Status
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
                }
