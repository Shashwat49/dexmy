import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherLayout from "../../components/TeacherLayout";
import { RefreshIcon, FlagIcon, CheckIcon, CloseIcon, SearchIcon, CircleIcon, ChevronDownIcon, ArrowRightIcon } from "../../components/Icons";
import { fetchWithAuth } from "../../src/api";

function StudentsReport() {
    const navigate = useNavigate();

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    const [selectedReport, setSelectedReport] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    // =====================================================
    // FETCH REPORTS
    // =====================================================

    const fetchReports = async () => {
        try {
            setLoading(true);
            setMessage("");

            const response = await fetchWithAuth(
                "/api/question-reports"
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Failed to fetch reports"
                );
            }

            setReports(data.reports || []);
        } catch (error) {
            setMessage(error.message || "Failed to load reports");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    // =====================================================
    // FILTER REPORTS
    // =====================================================

    const filteredReports = useMemo(() => {
        const search = searchTerm.toLowerCase().trim();

        return reports.filter((report) => {
            const examTitle =
                report.examId?.title ||
                report.exam?.title ||
                "";

            const questionText =
                report.questionId?.questionText ||
                report.question?.questionText ||
                "";

            const reason = report.reason || "";

            const studentName =
                report.studentName ||
                report.student?.name ||
                report.studentId?.name ||
                "";

            const matchesSearch =
                !search ||
                examTitle.toLowerCase().includes(search) ||
                questionText.toLowerCase().includes(search) ||
                reason.toLowerCase().includes(search) ||
                studentName.toLowerCase().includes(search);

            const reportStatus = (
                report.status || "pending"
            ).toLowerCase();

            const matchesStatus =
                statusFilter === "All" ||
                reportStatus === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [reports, searchTerm, statusFilter]);

    // =====================================================
    // UPDATE REPORT STATUS
    // =====================================================

    const handleStatusUpdate = async (reportId, status) => {
        try {
            setUpdatingId(reportId);
            setMessage("");

            const response = await fetchWithAuth(
                `/api/question-reports/${reportId}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        status,
                    }),
                }
            );

            const contentType =
                response.headers.get("content-type") || "";

            const data = contentType.includes("application/json")
                ? await response.json()
                : {};

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Failed to update report (${response.status})`
                );
            }

            const updatedStatus =
                data.report?.status || status;

            setReports((previousReports) =>
                previousReports.map((report) =>
                    report._id === reportId
                        ? {
                            ...report,
                            status: updatedStatus,
                        }
                        : report
                )
            );

            setSelectedReport((previous) =>
                previous
                    ? {
                        ...previous,
                        status: updatedStatus,
                    }
                    : previous
            );

            setMessage(
                updatedStatus === "Resolved"
                    ? "Report marked as resolved."
                    : updatedStatus === "Reviewed"
                        ? "Report marked as reviewed."
                        : "Report marked as pending."
            );

        } catch (error) {
            setMessage(
                error.message || "Failed to update report"
            );
        } finally {
            setUpdatingId(null);
        }
    };

    // =====================================================
    // HELPERS
    // =====================================================

    const getStatusClass = (status) => {
        switch (status?.toLowerCase()) {
            case "resolved":
                return "bg-emerald-50 text-emerald-700 border-emerald-200";

            case "reviewed":
                return "bg-blue-50 text-blue-700 border-blue-200";

            case "pending":
            default:
                return "bg-amber-50 text-amber-700 border-amber-200";
        }
    };
    const getReasonClass = (reason) => {
        if (reason === "Question is incorrect") {
            return "bg-red-50 text-red-700 border-red-200";
        }

        if (reason === "Options are incorrect") {
            return "bg-orange-50 text-orange-700 border-orange-200";
        }

        if (reason === "Image / Graph issue") {
            return "bg-purple-50 text-purple-700 border-purple-200";
        }

        if (reason === "Question is unclear") {
            return "bg-blue-50 text-blue-700 border-blue-200";
        }

        return "bg-slate-50 text-slate-700 border-slate-200";
    };

    const getExamTitle = (report) => {
        return (
            report.examId?.title ||
            report.exam?.title ||
            report.examTitle ||
            "Unknown Exam"
        );
    };

    const getQuestionText = (report) => {
        return (
            report.questionId?.questionText ||
            report.question?.questionText ||
            report.questionText ||
            "Question details unavailable"
        );
    };

    const getStudentName = (report) => {
        return (
            report.studentName ||
            report.student?.name ||
            report.studentId?.name ||
            "Student"
        );
    };

    const getDate = (report) => {
        if (!report.createdAt) {
            return "Recently";
        }

        return new Date(report.createdAt).toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    };

    // =====================================================
    // STATS
    // =====================================================

    const totalReports = reports.length;

    const pendingReports = reports.filter(
        (report) =>
            !report.status ||
            report.status.toLowerCase() === "pending"
    ).length;

    const reviewedReports = reports.filter(
        (report) =>
            report.status?.toLowerCase() === "reviewed"
    ).length;

    const resolvedReports = reports.filter(
        (report) =>
            report.status?.toLowerCase() === "resolved"
    ).length;;

    // =====================================================
    // UI
    // =====================================================

    return (
        <TeacherLayout>

            <div className="min-h-screen bg-[#f5f6f4]">

                <div className="max-w-7xl mx-auto px-5 py-7 lg:px-8">

                    {/* =================================================
                        PAGE HEADER
                    ================================================= */}

                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-7">

                        <div>

                            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#0b5968]">
                                STUDENT FEEDBACK
                            </p>

                            <h1 className="text-2xl lg:text-3xl font-bold text-[#0b211a] mt-1">
                                Students Report
                            </h1>

                            <p className="text-sm text-[#66756e] mt-2">
                                Review questions reported by students and
                                take necessary action.
                            </p>

                        </div>

                        <div className="flex items-center gap-3">

                            <button
                                type="button"
                                onClick={fetchReports}
                                disabled={loading}
                                className="px-4 py-2.5 rounded-lg border border-[#cbd7d1] bg-white text-[#0b5968] text-sm font-semibold hover:bg-[#eef5f2] transition disabled:opacity-50"
                            >
                                <><RefreshIcon size={15} /> Refresh</>
                            </button>

                        </div>

                    </div>


                    {/* =================================================
                        STATS
                    ================================================= */}

                    {/* =================================================
    STATS
================================================= */}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">

                        {/* TOTAL REPORTS */}

                        <div
                            onClick={() => setStatusFilter("All")}
                            className={`bg-white border rounded-xl p-5 cursor-pointer transition-all duration-200 ${statusFilter === "All"
                                ? "border-[#0b5968] shadow-sm ring-2 ring-[#0b5968]/10"
                                : "border-[#dce3df] hover:border-[#9fb3aa] hover:shadow-sm"
                                }`}
                        >

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-xs font-medium text-[#718078]">
                                        Total Reports
                                    </p>

                                    <p className="text-3xl font-bold text-[#0b211a] mt-2">
                                        {loading ? "..." : totalReports}
                                    </p>

                                </div>

                                <div className="w-11 h-11 rounded-xl bg-[#e8f4ed] text-[#0b5968] flex items-center justify-center text-xl">
                                    <FlagIcon size={14} className="text-current" />
                                </div>

                            </div>

                            <div className="flex items-center justify-between mt-4">

                                <p className="text-xs text-[#8a9691]">
                                    All student reports
                                </p>

                                {statusFilter === "All" && (
                                    <span className="text-[10px] font-bold text-[#0b5968]">
                                        ACTIVE
                                    </span>
                                )}

                            </div>

                        </div>


                        {/* PENDING */}

                        <div
                            onClick={() => setStatusFilter("pending")}
                            className={`bg-white border rounded-xl p-5 cursor-pointer transition-all duration-200 ${statusFilter === "Pending"
                                ? "border-[#d6a500] shadow-sm ring-2 ring-[#f5b91e]/20"
                                : "border-[#dce3df] hover:border-[#e6c35c] hover:shadow-sm"
                                }`}
                        >

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-xs font-medium text-[#718078]">
                                        Pending
                                    </p>

                                    <p className="text-3xl font-bold text-[#0b211a] mt-2">
                                        {loading ? "..." : pendingReports}
                                    </p>

                                </div>

                                <div className="w-11 h-11 rounded-xl bg-[#fff5d9] text-[#b77900] flex items-center justify-center text-xl">
                                    !
                                </div>

                            </div>

                            <div className="flex items-center justify-between mt-4">

                                <p className="text-xs text-[#8a9691]">
                                    Need your attention
                                </p>

                                {statusFilter === "Pending" && (
                                    <span className="text-[10px] font-bold text-[#b77900]">
                                        ACTIVE
                                    </span>
                                )}

                            </div>

                        </div>


                        {/* REVIEWED */}

                        <div
                            onClick={() => setStatusFilter("reviewed")}
                            className={`bg-white border rounded-xl p-5 cursor-pointer transition-all duration-200 ${statusFilter === "Reviewed"
                                ? "border-[#2563eb] shadow-sm ring-2 ring-blue-500/10"
                                : "border-[#dce3df] hover:border-[#9bbcf5] hover:shadow-sm"
                                }`}
                        >

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-xs font-medium text-[#718078]">
                                        Reviewed
                                    </p>

                                    <p className="text-3xl font-bold text-[#0b211a] mt-2">
                                        {loading ? "..." : reviewedReports}
                                    </p>

                                </div>

                                <div className="w-11 h-11 rounded-xl bg-[#edf3ff] text-[#2563eb] flex items-center justify-center text-xl">
                                    <CheckIcon size={20} />
                                </div>

                            </div>

                            <div className="flex items-center justify-between mt-4">

                                <p className="text-xs text-[#8a9691]">
                                    Reports checked
                                </p>

                                {statusFilter === "Reviewed" && (
                                    <span className="text-[10px] font-bold text-[#2563eb]">
                                        ACTIVE
                                    </span>
                                )}

                            </div>

                        </div>


                        {/* RESOLVED */}

                        <div
                            onClick={() => setStatusFilter("resolved")}
                            className={`bg-white border rounded-xl p-5 cursor-pointer transition-all duration-200 ${statusFilter === "Resolved"
                                ? "border-[#16834d] shadow-sm ring-2 ring-emerald-500/10"
                                : "border-[#dce3df] hover:border-[#9ed0b4] hover:shadow-sm"
                                }`}
                        >

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-xs font-medium text-[#718078]">
                                        Resolved
                                    </p>

                                    <p className="text-3xl font-bold text-[#0b211a] mt-2">
                                        {loading ? "..." : resolvedReports}
                                    </p>

                                </div>

                                <div className="w-11 h-11 rounded-xl bg-[#e8f6ef] text-[#16834d] flex items-center justify-center text-xl">
                                    <CheckIcon size={20} />
                                </div>

                            </div>

                            <div className="flex items-center justify-between mt-4">

                                <p className="text-xs text-[#8a9691]">
                                    Issues completed
                                </p>

                                {statusFilter === "Resolved" && (
                                    <span className="text-[10px] font-bold text-[#16834d]">
                                        ACTIVE
                                    </span>
                                )}

                            </div>

                        </div>

                    </div>


                    {/* =================================================
                        SEARCH / FILTER
                    ================================================= */}

                    <div className="bg-white border border-[#dce3df] rounded-xl p-4 mb-5">

                        <div className="flex flex-col md:flex-row gap-3">

                            <div className="relative flex-1">

                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#82918a]">
                                    
                                </span>

                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    placeholder="Search by exam, question, student or issue..."
                                    className="w-full h-11 rounded-lg border border-[#cbd7d1] bg-[#fafbf9] pl-11 pr-4 text-sm text-[#102a25] outline-none focus:border-[#0b5968] focus:ring-2 focus:ring-[#0b5968]/10"
                                />

                            </div>


                            <div className="relative md:w-48">

                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0b5968] text-sm pointer-events-none">
                                    <CircleIcon size={14} />
                                </span>

                                <select
                                    value={statusFilter}
                                    onChange={(e) =>
                                        setStatusFilter(e.target.value)
                                    }
                                    className="w-full h-11 appearance-none rounded-xl border border-[#cbd7d1] bg-[#fafbf9] pl-10 pr-10 text-sm font-semibold text-[#102a25] outline-none cursor-pointer transition focus:border-[#0b5968] focus:ring-4 focus:ring-[#0b5968]/10 hover:border-[#9fb3aa]"
                                >
                                    <option value="All">
                                        All Status
                                    </option>

                                    <option value="pending">
                                        Pending
                                    </option>

                                    <option value="reviewed">
                                        Reviewed
                                    </option>

                                    <option value="resolved">
                                        Resolved
                                    </option>
                                </select>

                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#687770] pointer-events-none">
                                    <ChevronDownIcon size={14} />
                                </span>

                            </div>

                        </div>

                    </div>


                    {/* =================================================
                        MESSAGE
                    ================================================= */}

                    {message && (
                        <div className="mb-5 px-4 py-3 rounded-lg border border-[#dce3df] bg-white text-sm text-[#475a52]">
                            {message}
                        </div>
                    )}


                    {/* =================================================
                        LOADING
                    ================================================= */}

                    {loading && (
                        <div className="bg-white border border-[#dce3df] rounded-xl p-12 text-center">

                            <div className="w-10 h-10 mx-auto border-4 border-[#dce3df] border-t-[#0b5968] rounded-full animate-spin" />

                            <p className="text-sm text-[#718078] mt-4">
                                Loading student reports...
                            </p>

                        </div>
                    )}


                    {/* =================================================
                        EMPTY
                    ================================================= */}

                    {!loading && filteredReports.length === 0 && (

                        <div className="bg-white border border-[#dce3df] rounded-xl p-12 text-center">

                            <div className="w-14 h-14 mx-auto rounded-xl bg-[#edf4f0] flex items-center justify-center text-2xl">
                                <FlagIcon size={14} className="text-current" />
                            </div>

                            <h2 className="text-lg font-bold text-[#0b211a] mt-4">
                                No reports found
                            </h2>

                            <p className="text-sm text-[#718078] mt-1">
                                {searchTerm || statusFilter !== "All"
                                    ? "Try changing your search or filter."
                                    : "Student question reports will appear here."}
                            </p>

                        </div>

                    )}


                    {/* =================================================
                        REPORT LIST
                    ================================================= */}

                    {!loading && filteredReports.length > 0 && (

                        <div className="space-y-4">

                            {filteredReports.map((report) => {

                                const status =
                                    report.status || "Pending";

                                return (

                                    <div
                                        key={report._id}
                                        className="bg-white border border-[#dce3df] rounded-xl overflow-hidden hover:shadow-sm transition"
                                    >

                                        {/* Top section */}

                                        <div className="p-5">

                                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">

                                                <div className="min-w-0 flex-1">

                                                    <div className="flex flex-wrap items-center gap-2 mb-3">

                                                        <span className="px-2.5 py-1 rounded-full bg-[#eef5f2] text-[#0b5968] border border-[#d7e5df] text-[11px] font-bold">
                                                            {getExamTitle(report)}
                                                        </span>

                                                        <span
                                                            className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${getReasonClass(
                                                                report.reason
                                                            )}`}
                                                        >
                                                            {report.reason ||
                                                                "Other issue"}
                                                        </span>

                                                    </div>


                                                    <h2 className="text-base font-bold text-[#102a25] leading-6">
                                                        {getQuestionText(report)}
                                                    </h2>


                                                    {report.description && (
                                                        <div className="mt-3 bg-[#f7f8f6] border border-[#e1e7e3] rounded-lg px-4 py-3">

                                                            <p className="text-[11px] font-bold uppercase tracking-wide text-[#7b8983] mb-1">
                                                                Student's Description
                                                            </p>

                                                            <p className="text-sm text-[#4e6259] leading-6">
                                                                {report.description}
                                                            </p>

                                                        </div>
                                                    )}

                                                </div>


                                                <div className="shrink-0">

                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${getStatusClass(
                                                            status
                                                        )}`}
                                                    >
                                                        <span>
                                                            {status?.toLowerCase() === "resolved"
                                                                ? <CheckIcon size={14} />
                                                                : status?.toLowerCase() === "reviewed"
                                                                    ? <CircleIcon size={14} />
                                                                    : "!"}
                                                        </span>

                                                        {status
                                                            ? status.charAt(0).toUpperCase() +
                                                            status.slice(1).toLowerCase()
                                                            : "Pending"}
                                                    </span>

                                                </div>

                                            </div>


                                            {/* Meta */}

                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-5 pt-4 border-t border-[#edf0ee]">

                                                <div>

                                                    <p className="text-[10px] uppercase tracking-wide text-[#89958f]">
                                                        Student
                                                    </p>

                                                    <p className="text-sm font-semibold text-[#334a41] mt-0.5">
                                                        {getStudentName(report)}
                                                    </p>

                                                </div>


                                                <div>

                                                    <p className="text-[10px] uppercase tracking-wide text-[#89958f]">
                                                        Submitted
                                                    </p>

                                                    <p className="text-sm font-medium text-[#52645c] mt-0.5">
                                                        {getDate(report)}
                                                    </p>

                                                </div>


                                                {report.questionId?._id && (
                                                    <div>

                                                        <p className="text-[10px] uppercase tracking-wide text-[#89958f]">
                                                            Question ID
                                                        </p>

                                                        <p className="text-xs font-mono text-[#52645c] mt-0.5">
                                                            {report.questionId._id}
                                                        </p>

                                                    </div>
                                                )}

                                            </div>

                                        </div>


                                        {/* Actions */}

                                        <div className="px-5 py-3 bg-[#fafbf9] border-t border-[#e4e9e6] flex flex-wrap items-center justify-between gap-3">

                                            <div className="flex items-center gap-2">

                                                {status !== "Resolved" && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleStatusUpdate(
                                                                report._id,
                                                                "resolved"
                                                            )
                                                        }
                                                        disabled={
                                                            updatingId ===
                                                            report._id
                                                        }
                                                        className="px-3.5 py-2 rounded-lg bg-[#0b211a] text-white text-xs font-semibold hover:bg-[#12382c] transition disabled:opacity-50"
                                                    >
                                                        {updatingId ===
                                                            report._id
                                                            ? "Updating..."
                                                            : <><CheckIcon size={14} /> Mark Resolved</>}
                                                    </button>
                                                )}

                                                {status === "Resolved" && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleStatusUpdate(
                                                                report._id,
                                                                "pending"
                                                            )
                                                        }
                                                        disabled={
                                                            updatingId ===
                                                            report._id
                                                        }
                                                        className="px-3.5 py-2 rounded-lg border border-[#cbd7d1] bg-white text-[#52645c] text-xs font-semibold hover:bg-[#eef5f2] transition disabled:opacity-50"
                                                    >
                                                        Mark Pending
                                                    </button>
                                                )}

                                            </div>


                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedReport(report)
                                                }
                                                className="px-4 py-2 rounded-lg border border-[#b9cbc3] bg-white text-[#0b5968] text-xs font-bold hover:bg-[#eef5f2] transition"
                                            >
                                                View Details
                                            </button>

                                        </div>

                                    </div>

                                );
                            })}

                        </div>

                    )}

                </div>


                {/* =====================================================
                    REPORT DETAILS MODAL
                ===================================================== */}

                {selectedReport && (

                    <div className="fixed inset-0 z-50 bg-[#071a14]/70 backdrop-blur-sm flex items-center justify-center p-4">

                        <div className="w-full max-w-2xl max-h-[90vh] bg-[#f8f7f2] rounded-2xl shadow-2xl overflow-hidden border border-[#29463b] flex flex-col">

                            {/* Modal Header */}

                            <div className="shrink-0 bg-[#0b211a] px-5 py-4 flex items-center justify-between">

                                <div className="min-w-0">

                                    <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#f5b91e]">
                                        Student Report
                                    </p>

                                    <h2 className="text-lg font-bold text-[#f4efe3] mt-1 truncate">
                                        {getExamTitle(selectedReport)}
                                    </h2>

                                </div>


                                <button
                                    type="button"
                                    onClick={() =>
                                        setSelectedReport(null)
                                    }
                                    className="w-9 h-9 rounded-full border border-[#3c5d50] text-[#f4efe3] flex items-center justify-center text-xl hover:bg-[#f5b91e] hover:text-[#071a14] transition"
                                ><CloseIcon size={18} /></button>

                            </div>


                            {/* Modal Body */}

                            <div className="flex-1 overflow-y-auto p-5">

                                {/* Status */}

                                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">

                                    <span
                                        className={`px-3 py-1.5 rounded-full border text-xs font-bold ${getStatusClass(
                                            selectedReport.status ||
                                            "Pending"
                                        )}`}
                                    >
                                        {selectedReport.status ||
                                            "Pending"}
                                    </span>

                                    <span className="text-xs text-[#7b8983]">
                                        {getDate(selectedReport)}
                                    </span>

                                </div>


                                {/* Question */}

                                <div className="bg-white border border-[#dce3df] rounded-xl p-5">

                                    <p className="text-[10px] font-bold tracking-wide uppercase text-[#0b5968] mb-2">
                                        Reported Question
                                    </p>

                                    <h3 className="text-base font-bold text-[#102a25] leading-6">
                                        {getQuestionText(
                                            selectedReport
                                        )}
                                    </h3>

                                </div>


                                {/* Issue */}

                                <div className="mt-4">

                                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b8983] mb-2">
                                        Report Type
                                    </p>

                                    <span
                                        className={`inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${getReasonClass(
                                            selectedReport.reason
                                        )}`}
                                    >
                                        {selectedReport.reason ||
                                            "Other issue"}
                                    </span>

                                </div>


                                {/* Description */}

                                <div className="mt-5">

                                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b8983] mb-2">
                                        Student Description
                                    </p>

                                    <div className="bg-white border border-[#dce3df] rounded-xl p-4">

                                        <p className="text-sm text-[#40564c] leading-6">
                                            {selectedReport.description ||
                                                "No additional details were provided by the student."}
                                        </p>

                                    </div>

                                </div>


                                {/* Student */}

                                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">

                                    <div className="bg-white border border-[#dce3df] rounded-xl p-4">

                                        <p className="text-[10px] uppercase tracking-wide text-[#89958f]">
                                            Student
                                        </p>

                                        <p className="text-sm font-semibold text-[#102a25] mt-1">
                                            {getStudentName(
                                                selectedReport
                                            )}
                                        </p>

                                    </div>


                                    <div className="bg-white border border-[#dce3df] rounded-xl p-4">

                                        <p className="text-[10px] uppercase tracking-wide text-[#89958f]">
                                            Exam
                                        </p>

                                        <p className="text-sm font-semibold text-[#102a25] mt-1">
                                            {getExamTitle(
                                                selectedReport
                                            )}
                                        </p>

                                    </div>

                                </div>

                            </div>


                            {/* Modal Footer */}

                            <div className="shrink-0 px-5 py-4 border-t border-[#dce3df] bg-white flex flex-wrap justify-end gap-3">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSelectedReport(null)
                                    }
                                    className="px-4 py-2.5 rounded-lg border border-[#b8c8c1] text-[#0b5968] text-sm font-semibold hover:bg-[#eef5f2]"
                                >
                                    Close
                                </button>


                                {(selectedReport.status ||
                                    "Pending") !== "Resolved" && (

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleStatusUpdate(
                                                    selectedReport._id,
                                                    "resolved"
                                                )
                                            }
                                            disabled={
                                                updatingId ===
                                                selectedReport._id
                                            }
                                            className="px-5 py-2.5 rounded-lg bg-[#f5b91e] text-[#071a14] text-sm font-bold hover:bg-[#ffcf26] transition disabled:opacity-50"
                                        >
                                            {updatingId ===
                                                selectedReport._id
                                                ? "Updating..."
                                                : <><CheckIcon size={14} /> Mark Resolved</>}
                                        </button>

                                    )}

                            </div>

                        </div>

                    </div>

                )}

            </div>

        </TeacherLayout>
    );
}

export default StudentsReport;