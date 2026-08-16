import { useEffect, useState } from "react";

import {
    getMyTeacherProfile,
    updateMyTeacherProfile,
} from "../../../api/teachers";

import { getSubjects } from "../../../api/subjects";


export default function TeacherProfile() {
    const [profile, setProfile] = useState(null);
    const [subjects, setSubjects] = useState([]);

    const [form, setForm] = useState({
        bio: "",
        qualifications: "",
        years_experience: "",
        hourly_rate: "",
        subject_ids: [],
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");


    useEffect(() => {
        async function loadProfile() {
            try {
                setLoading(true);
                setError("");

                const [
                    teacherProfile,
                    availableSubjects,
                ] = await Promise.all([
                    getMyTeacherProfile(),
                    getSubjects(),
                ]);

                setProfile(teacherProfile);
                setSubjects(availableSubjects);

                setForm({
                    bio: teacherProfile.bio || "",
                    qualifications:
                        teacherProfile.qualifications || "",
                    years_experience:
                        teacherProfile.years_experience ?? "",
                    hourly_rate:
                        teacherProfile.hourly_rate ?? "",
                    subject_ids:
                        teacherProfile.subject_ids || [],
                });

            } catch (err) {
                setError(
                    err.response?.data?.detail ||
                    "Unable to load your profile."
                );
            } finally {
                setLoading(false);
            }
        }

        loadProfile();
    }, []);


    function updateField(field, value) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));

        setSuccess("");
    }


    function toggleSubject(subjectId) {
        setForm((current) => {
            const selected =
                current.subject_ids.includes(subjectId);

            return {
                ...current,

                subject_ids: selected
                    ? current.subject_ids.filter(
                        (id) => id !== subjectId
                    )
                    : [
                        ...current.subject_ids,
                        subjectId,
                    ],
            };
        });

        setSuccess("");
    }


    async function handleSubmit(event) {
        event.preventDefault();

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            const updated =
                await updateMyTeacherProfile({
                    bio: form.bio.trim() || null,

                    qualifications:
                        form.qualifications.trim() || null,

                    years_experience:
                        form.years_experience === ""
                            ? null
                            : Number(form.years_experience),

                    hourly_rate:
                        form.hourly_rate === ""
                            ? null
                            : Number(form.hourly_rate),

                    subject_ids:
                        form.subject_ids,
                });

            setProfile(updated);

            setForm((current) => ({
                ...current,
                subject_ids:
                    updated.subject_ids || [],
            }));

            setSuccess(
                "Your teacher profile has been saved."
            );

        } catch (err) {
            setError(
                err.response?.data?.detail ||
                "Unable to save your profile."
            );
        } finally {
            setSaving(false);
        }
    }


    if (loading) {
        return (
            <div className="p-8">
                <p className="text-sm text-chalk-muted">
                    Loading teacher profile...
                </p>
            </div>
        );
    }


    return (
        <div className="p-6 md:p-8 max-w-5xl">

            {/* Header */}

            <div className="mb-8">

                <h1 className="text-2xl font-semibold">
                    Edit Teacher Profile
                </h1>

                <p className="text-sm text-chalk-muted mt-2">
                    Update the information students will see on
                    your public Dexmy teacher profile.
                </p>

            </div>


            {/* Alerts */}

            {error && (
                <div className="mb-6 rounded-xl border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
                    {success}
                </div>
            )}


            <form
                onSubmit={handleSubmit}
                className="space-y-6"
            >

                {/* About */}

                <section className="rounded-2xl border border-chalk-faint bg-panel p-6">

                    <div className="mb-5">

                        <h2 className="text-lg font-semibold">
                            About you
                        </h2>

                        <p className="text-sm text-chalk-muted mt-1">
                            Tell students what makes your teaching
                            approach different.
                        </p>

                    </div>

                    <textarea
                        value={form.bio}
                        onChange={(event) =>
                            updateField(
                                "bio",
                                event.target.value
                            )
                        }
                        rows={6}
                        maxLength={2000}
                        placeholder="Example: I specialize in SAT Mathematics and AP Calculus..."
                        className="w-full resize-none rounded-xl border border-chalk-faint bg-panel-3 px-4 py-3 text-sm text-chalk outline-none transition focus:border-brand-gold"
                    />

                    <div className="mt-2 text-right text-xs text-chalk-muted">
                        {form.bio.length}/2000
                    </div>

                </section>


                {/* Qualifications */}

                <section className="rounded-2xl border border-chalk-faint bg-panel p-6">

                    <div className="mb-5">

                        <h2 className="text-lg font-semibold">
                            Qualifications
                        </h2>

                        <p className="text-sm text-chalk-muted mt-1">
                            Add your degrees, certifications,
                            and relevant qualifications.
                        </p>

                    </div>

                    <textarea
                        value={form.qualifications}
                        onChange={(event) =>
                            updateField(
                                "qualifications",
                                event.target.value
                            )
                        }
                        rows={5}
                        maxLength={1500}
                        placeholder="Example: B.Tech, Mathematics teaching certification..."
                        className="w-full resize-none rounded-xl border border-chalk-faint bg-panel-3 px-4 py-3 text-sm text-chalk outline-none transition focus:border-brand-gold"
                    />

                </section>


                {/* Professional information */}

                <section className="rounded-2xl border border-chalk-faint bg-panel p-6">

                    <div className="mb-5">

                        <h2 className="text-lg font-semibold">
                            Professional information
                        </h2>

                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        <div>

                            <label className="block text-sm font-medium mb-2">
                                Years of experience
                            </label>

                            <input
                                type="number"
                                min="0"
                                max="60"
                                value={form.years_experience}
                                onChange={(event) =>
                                    updateField(
                                        "years_experience",
                                        event.target.value
                                    )
                                }
                                placeholder="e.g. 5"
                                className="w-full rounded-xl border border-chalk-faint bg-panel-3 px-4 py-3 text-sm outline-none focus:border-brand-gold"
                            />

                        </div>


                        <div>

                            <label className="block text-sm font-medium mb-2">
                                Hourly rate
                            </label>

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.hourly_rate}
                                onChange={(event) =>
                                    updateField(
                                        "hourly_rate",
                                        event.target.value
                                    )
                                }
                                placeholder="e.g. 30"
                                className="w-full rounded-xl border border-chalk-faint bg-panel-3 px-4 py-3 text-sm outline-none focus:border-brand-gold"
                            />

                        </div>

                    </div>

                </section>


                {/* Subjects */}

                <section className="rounded-2xl border border-chalk-faint bg-panel p-6">

                    <div className="mb-5">

                        <h2 className="text-lg font-semibold">
                            Subjects you teach
                        </h2>

                        <p className="text-sm text-chalk-muted mt-1">
                            Select all subjects you are qualified
                            to teach.
                        </p>

                    </div>


                    {subjects.length === 0 ? (

                        <div className="rounded-xl border border-chalk-faint bg-panel-3 p-5 text-sm text-chalk-muted">
                            No subjects are available yet.
                            Ask an administrator to add subjects.
                        </div>

                    ) : (

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                            {subjects.map((subject) => {

                                const selected =
                                    form.subject_ids.includes(
                                        subject.id
                                    );

                                return (
                                    <button
                                        key={subject.id}
                                        type="button"
                                        onClick={() =>
                                            toggleSubject(subject.id)
                                        }
                                        className={`rounded-xl border p-4 text-left transition ${selected
                                                ? "border-brand-gold bg-brand-gold/10"
                                                : "border-chalk-faint bg-panel-3 hover:border-chalk-muted"
                                            }`}
                                    >

                                        <div className="flex items-start gap-3">

                                            <div
                                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${selected
                                                        ? "border-brand-gold bg-brand-gold text-black"
                                                        : "border-chalk-muted"
                                                    }`}
                                            >
                                                {selected ? "✓" : ""}
                                            </div>

                                            <div>

                                                <div className="text-sm font-medium">
                                                    {subject.name}
                                                </div>

                                                {subject.description && (
                                                    <div className="mt-1 text-xs text-chalk-muted">
                                                        {subject.description}
                                                    </div>
                                                )}

                                            </div>

                                        </div>

                                    </button>
                                );
                            })}

                        </div>
                    )}

                </section>


                {/* Verification */}

                <section className="rounded-2xl border border-chalk-faint bg-panel p-6">

                    <h2 className="text-lg font-semibold">
                        Verification
                    </h2>

                    <div className="mt-3">

                        {profile?.is_verified ? (

                            <div className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1.5 text-sm text-green-400">
                                <span>✓</span>
                                Verified teacher
                            </div>

                        ) : (

                            <div className="inline-flex items-center gap-2 rounded-full bg-brand-gold/10 px-3 py-1.5 text-sm text-brand-gold">
                                <span>•</span>
                                Verification pending
                            </div>

                        )}

                    </div>

                    {!profile?.is_verified && (
                        <p className="mt-3 text-xs text-chalk-muted">
                            Your profile must be verified by Dexmy
                            before it appears in the public teacher
                            marketplace.
                        </p>
                    )}

                </section>


                {/* Save */}

                <div className="flex justify-end">

                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-brand-red px-6 py-3 text-sm font-semibold transition hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving
                            ? "Saving..."
                            : "Save profile"}
                    </button>

                </div>

            </form>

        </div>
    );
}