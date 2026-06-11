"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_GROUPS = [
  {
    id: "pg_nep",
    label: "PG / Semester / NEP",
    subtitle: "PG semester, MBA, MCA, LLM and related results",
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
    subtitle: "MA, MSc, MCom annual results",
    options: []
  },
  {
    id: "ug_annual",
    label: "UG Annual / Old Scheme",
    subtitle: "BA, BSc, BCom Part results",
    options: []
  },
  {
    id: "bed_med",
    label: "B.Ed / M.Ed / Integrated",
    subtitle: "B.Ed, BA B.Ed, BSc B.Ed, M.Ed results",
    options: []
  },
  {
    id: "credit_other",
    label: "Credit / Other",
    subtitle: "Credit based and other semester results",
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

        const res = await fetch("/api/result-course-options", {
          cache: "no-store"
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Course options load nahi ho paye.");
        }

        if (!alive) return;

        const loadedGroups = Array.isArray(data.groups) ? data.groups : [];
        const filtered = loadedGroups.filter((group) => group.id !== "all");

        setGroups(filtered.length ? filtered : DEFAULT_GROUPS);

        const firstWithOptions = filtered.find(
          (group) => Array.isArray(group.options) && group.options.length
        );

        if (firstWithOptions) {
          setActiveGroup(firstWithOptions.id);
        }
      } catch (err) {
        if (!alive) return;
        setOptionsError(err.message || "Course options load nahi ho paye.");
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

    let list = flatOptions.filter((option) => option.groupId === activeGroup);

    if (term) {
      list = flatOptions.filter((option) => {
        const hay = `${option.label || ""} ${option.yearPart || ""} ${
          option.groupLabel || ""
        }`.toLowerCase();

        return hay.includes(term);
      });
    }

    return list;
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

    const cleanRoll = rollNo.replace(/\s+/g, "").trim();
    const cleanName = studentName.trim();
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
    <main className="min-h-screen bg-[#f6f3ee] text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="mb-4 inline-flex rounded-full bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                PDUSU Result Alert
              </div>

              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Result alert ke liye roll number register karo
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Result available hote hi system official portal se result check
                karega. Admin team ko verification ke liye preview milega, aur
                aap status page par apna result status check kar sakenge.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-2xl font-black text-slate-950">1</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Course aur roll number register
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-2xl font-black text-slate-950">2</div>
                  <p className="mt-1 text-sm text-slate-600">
                    System official result portal check karega
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-2xl font-black text-slate-950">3</div>
                  <p className="mt-1 text-sm text-slate-600">
                    Status page par result update dikhega
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                WhatsApp result/update sirf verified alert list ke numbers par
                jayega. Baaki students status page se result status check kar
                sakte hain.
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                Duplicate rule: same roll number + same course + same result
                type + same result year ek baar hi register hoga.
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-5 sm:p-6"
            >
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    Student Name
                  </span>
                  <input
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
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
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
                    placeholder="Example: 26331464"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    WhatsApp / Mobile Number
                  </span>
                  <input
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
                    placeholder="Example: 9358282738"
                  />
                  <span className="text-xs text-slate-500">
                    WhatsApp result/update sirf verified alert list numbers par
                    jayega.
                  </span>
                </label>

                <div className="grid gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    Course / Result Option
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => {
                          setActiveGroup(group.id);
                          setSearch("");
                        }}
                        className={cls(
                          "rounded-full px-3 py-2 text-xs font-bold",
                          activeGroup === group.id
                            ? "bg-slate-950 text-white"
                            : "bg-white text-slate-700 ring-1 ring-slate-200"
                        )}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
                    placeholder="Search: M.COM ABST, B.A, B.SC, B.ED..."
                  />

                  <select
                    value={selectedValue}
                    onChange={(event) => setSelectedValue(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-orange-400"
                    disabled={loadingOptions}
                  >
                    <option value="">
                      {loadingOptions
                        ? "Loading options..."
                        : "Select course / result option"}
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

                  {optionsError ? (
                    <p className="text-xs font-semibold text-red-600">
                      {optionsError}
                    </p>
                  ) : null}

                  {selectedOption ? (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
                      Selected:{" "}
                      <b>{selectedOption.yearPart || selectedOption.label}</b>
                    </div>
                  ) : null}
                </div>

                <label className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  <input
                    type="checkbox"
                    checked={consentAdminPreview}
                    onChange={(event) =>
                      setConsentAdminPreview(event.target.checked)
                    }
                    className="mt-1"
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
                  className="rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
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
      </section>
    </main>
  );
}
