"use client";

import { useEffect, useMemo, useState } from "react";

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_ACTIVATE_NUMBER || "";

const FALLBACK_GROUPS = [
  {
    id: "pg_nep",
    label: "PG Semester",
    subtitle: "Fallback options",
    options: [
      {
        label: "M.COM ABST SEMESTER I",
        value: "M.COM ABST SEMESTER I",
        yearPart: "M.COM ABST SEMESTER I",
        formKey: "PG_NEP",
        formUrl: "https://result26.shekhauniexam.in/PG_NEP_RESULT.aspx"
      }
    ]
  }
];

const GROUP_LABELS = {
  all: "All Courses",
  pg_nep: "PG Semester",
  ug_nep: "UG Semester",
  pg_annual: "PG Annual",
  ug_annual: "UG Annual",
  bed_med: "B.Ed / M.Ed",
  credit_other: "Other",
  other: "Other"
};

function normalizeMobile(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.length === 10) return `91${digits}`;

  return digits;
}

function detectSemester(yearPart) {
  const y = String(yearPart || "").toUpperCase();

  if (y.includes("SEMESTER III")) return "III";
  if (y.includes("SEMESTER II")) return "II";
  if (y.includes("SEMESTER IV")) return "IV";
  if (y.includes("SEMESTER V") && !y.includes("VI")) return "V";
  if (y.includes("SEMESTER VI")) return "VI";
  if (y.includes("SEMESTER-I") || y.includes("SEMESTER I")) return "I";

  return "";
}

function detectCourse(yearPart) {
  return String(yearPart || "")
    .toUpperCase()
    .replace(/SEMESTER[- ]?I\b/g, "")
    .replace(/SEMESTER[- ]?II\b/g, "")
    .replace(/SEMESTER[- ]?III\b/g, "")
    .replace(/SEMESTER[- ]?IV\b/g, "")
    .replace(/SEMESTER[- ]?V\b/g, "")
    .replace(/SEMESTER[- ]?VI\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function optionText(option) {
  return option?.label || option?.yearPart || option?.value || "";
}

function optionKey(option) {
  return `${optionText(option)}_${option?.formUrl || ""}_${option?.formKey || ""}`;
}

function userGroupLabel(group) {
  return GROUP_LABELS[group?.id] || group?.label || "Result Group";
}

function whatsappActivateLink() {
  if (!WHATSAPP_NUMBER) return "";

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("RESULT")}`;
}

export default function ResultAlertPage() {
  const [groups, setGroups] = useState(FALLBACK_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState("pg_nep");
  const [search, setSearch] = useState("");
  const [selectedOptionKey, setSelectedOptionKey] = useState("");
  const [source, setSource] = useState("loading");

  const [form, setForm] = useState({
    studentName: "",
    rollNo: "",
    mobile: "",
    resultType: "MAIN",
    consentTelegramGroup: true,
    consentWhatsAppResult: true
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch("/api/result-course-options");
        const data = await res.json();

        if (data?.success && Array.isArray(data.groups) && data.groups.length) {
          const filtered = data.groups.filter((g) => g.id !== "all");
          const finalGroups = filtered.length ? filtered : data.groups;

          setGroups(finalGroups);
          setSource(data.source || "fallback");

          const firstNonEmpty =
            finalGroups.find((g) => g.options?.length && g.id === "pg_nep") ||
            finalGroups.find((g) => g.options?.length) ||
            finalGroups[0];

          if (firstNonEmpty?.id) {
            setSelectedGroupId(firstNonEmpty.id);
          }
        } else {
          setSource("fallback");
        }
      } catch {
        setSource("fallback");
      }
    }

    loadOptions();
  }, []);

  const selectedGroup = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId) || groups[0];
  }, [groups, selectedGroupId]);

  const allCurrentOptions = useMemo(() => {
    return selectedGroup?.options || [];
  }, [selectedGroup]);

  const selectedOption = useMemo(() => {
    return allCurrentOptions.find(
      (option) => optionKey(option) === selectedOptionKey
    );
  }, [allCurrentOptions, selectedOptionKey]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return allCurrentOptions;

    return allCurrentOptions.filter((option) => {
      const hay = `${optionText(option)} ${option?.formLabel || ""} ${
        option?.formKey || ""
      }`.toLowerCase();

      return hay.includes(q);
    });
  }, [allCurrentOptions, search]);

  function updateField(name, value) {
    setForm((old) => ({
      ...old,
      [name]: value
    }));
  }

  async function submitRegistration(e) {
    e.preventDefault();

    setMessage(null);

    const mobile = normalizeMobile(form.mobile);

    if (!form.studentName.trim()) {
      setMessage({
        type: "error",
        text: "Please enter student name."
      });
      return;
    }

    if (!form.rollNo.trim()) {
      setMessage({
        type: "error",
        text: "Please enter roll number."
      });
      return;
    }

    if (!selectedOption) {
      setMessage({
        type: "error",
        text: "Please select your exact course/semester."
      });
      return;
    }

    if (!mobile) {
      setMessage({
        type: "error",
        text: "Please enter WhatsApp mobile number."
      });
      return;
    }

    if (!form.consentTelegramGroup || !form.consentWhatsAppResult) {
      setMessage({
        type: "error",
        text: "Please accept result alert permissions."
      });
      return;
    }

    const yearPart = optionText(selectedOption);

    setLoading(true);

    try {
      const res = await fetch("/api/register-result-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          studentName: form.studentName,
          rollNo: form.rollNo,
          mobile,
          yearPart,
          course: detectCourse(yearPart),
          semester: detectSemester(yearPart),
          resultType: form.resultType,
          formUrl: selectedOption.formUrl,
          formKey: selectedOption.formKey,
          consentTelegramGroup: form.consentTelegramGroup,
          consentWhatsAppResult: form.consentWhatsAppResult
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Registration failed");
      }

      setMessage({
        type: "success",
        text: data.updated
          ? "Your registration details have been updated successfully."
          : "Registration successful. Result milte hi WhatsApp par summary bheji jayegi.",
        data
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || "Registration failed"
      });
    } finally {
      setLoading(false);
    }
  }

  const activateLink = whatsappActivateLink();

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-slate-900">
      <section className="relative overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.10),transparent_35%)]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-700">
                Apni Library
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                PDUSU Result Alert
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                Register your roll number once. When your result is available,
                you will receive a WhatsApp result summary.
              </p>
            </div>

            <div className="hidden rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-right shadow-sm sm:block">
              <p className="text-xs font-semibold text-slate-500">Options</p>
              <p className="text-sm font-bold text-emerald-700">
                {source === "worker+fallback"
                  ? "Live + Backup"
                  : source === "worker"
                  ? "Live"
                  : source === "loading"
                  ? "Loading..."
                  : "Backup"}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-2xl shadow-amber-900/10 backdrop-blur sm:p-8">
              <div className="mb-6 rounded-3xl bg-slate-950 p-5 text-white shadow-lg">
                <p className="text-sm font-semibold text-amber-300">
                  Step 1
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Enter student details
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Select exact course/semester from the official result options.
                </p>
              </div>

              <form onSubmit={submitRegistration} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Student Name
                    </span>
                    <input
                      value={form.studentName}
                      onChange={(e) =>
                        updateField("studentName", e.target.value)
                      }
                      placeholder="Example: Giriraj Pareek"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">
                      Roll Number
                    </span>
                    <input
                      value={form.rollNo}
                      onChange={(e) =>
                        updateField("rollNo", e.target.value.toUpperCase())
                      }
                      placeholder="Example: 26331464"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    WhatsApp Number
                  </span>
                  <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-100">
                    <span className="flex items-center border-r border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-600">
                      +91
                    </span>
                    <input
                      value={form.mobile}
                      onChange={(e) => updateField("mobile", e.target.value)}
                      placeholder="10 digit WhatsApp number"
                      inputMode="numeric"
                      className="w-full px-4 py-3 text-sm font-semibold outline-none"
                    />
                  </div>
                </label>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-700">
                      Select Result Category
                    </span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      Exact course required
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {groups.map((group) => (
                      <button
                        type="button"
                        key={group.id}
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setSearch("");
                          setSelectedOptionKey("");
                        }}
                        className={`rounded-2xl border px-3 py-3 text-left text-xs font-black transition ${
                          selectedGroupId === group.id
                            ? "border-amber-500 bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                            : "border-slate-200 bg-white text-slate-700 hover:border-amber-300"
                        }`}
                      >
                        <span className="block">{userGroupLabel(group)}</span>
                        {group.options?.length ? (
                          <span className="mt-1 block text-[10px] opacity-75">
                            {group.options.length} options
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Search Course
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type M.COM ABST, B.A SEMESTER I, B.ED, HISTORY..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Select Your Course / Semester
                  </span>
                  <select
                    value={selectedOptionKey}
                    onChange={(e) => setSelectedOptionKey(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  >
                    <option value="">Select exact course option</option>
                    {filteredOptions.map((option) => (
                      <option key={optionKey(option)} value={optionKey(option)}>
                        {optionText(option)}
                      </option>
                    ))}
                  </select>

                  {selectedOption ? (
                    <div className="mt-2 rounded-2xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-800">
                      Selected: {optionText(selectedOption)}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      Search and select the exact course/semester shown in the
                      official result list.
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Result Type
                  </span>
                  <select
                    value={form.resultType}
                    onChange={(e) => updateField("resultType", e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  >
                    <option value="MAIN">MAIN</option>
                    <option value="REVAL">REVAL</option>
                    <option value="SUPPLEMENTARY">SUPPLEMENTARY</option>
                    <option value="SPECIAL">SPECIAL</option>
                  </select>
                </label>

                <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={form.consentTelegramGroup}
                      onChange={(e) =>
                        updateField("consentTelegramGroup", e.target.checked)
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span className="text-sm font-semibold leading-6 text-slate-700">
                      I agree that Apni Library admin team may receive my result
                      preview for verification and alert delivery.
                    </span>
                  </label>

                  <label className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={form.consentWhatsAppResult}
                      onChange={(e) =>
                        updateField("consentWhatsAppResult", e.target.checked)
                      }
                      className="mt-1 h-4 w-4"
                    />
                    <span className="text-sm font-semibold leading-6 text-slate-700">
                      I agree to receive my PDUSU result summary on WhatsApp.
                    </span>
                  </label>
                </div>

                {message ? (
                  <div
                    className={`rounded-3xl border p-4 text-sm font-bold ${
                      message.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {message.text}

                    {message.type === "success" && activateLink ? (
                      <a
                        href={activateLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 block rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-black uppercase tracking-wide text-white shadow-lg"
                      >
                        Activate WhatsApp Alert
                      </a>
                    ) : null}

                    {message.data?.trackingId ? (
                      <div className="mt-3 rounded-2xl bg-white/70 p-3 text-xs">
                        <p>Tracking ID:</p>
                        <p className="break-all font-black">
                          {message.data.trackingId}
                        </p>
                        <p className="mt-2">Course:</p>
                        <p className="font-black">{message.data.yearPart}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl shadow-slate-900/20 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Registering..." : "Register for Result Alert"}
                </button>
              </form>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-xl shadow-amber-900/10">
                <h3 className="text-xl font-black text-slate-950">
                  What will happen next?
                </h3>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black text-slate-900">
                      Automatic checking
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Your result will be checked from the official university
                      portal.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black text-slate-900">
                      WhatsApp summary
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      If your result is found, you will receive a short result
                      summary on WhatsApp.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-black text-slate-900">
                      Official verification
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Always verify your full marksheet from the official
                      university website.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] bg-amber-500 p-6 text-white shadow-xl shadow-amber-500/20">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-100">
                  WhatsApp Tip
                </p>
                <h3 className="mt-2 text-2xl font-black">
                  Activate WhatsApp alerts
                </h3>
                <p className="mt-3 text-sm leading-6 text-amber-50">
                  Registration ke baad Apni Library WhatsApp number par
                  “RESULT” message bhejna better hai. Isse WhatsApp alert
                  delivery fast ho sakti hai.
                </p>

                {activateLink ? (
                  <a
                    href={activateLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 block rounded-2xl bg-white px-5 py-4 text-center text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg"
                  >
                    Send RESULT on WhatsApp
                  </a>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
      }
