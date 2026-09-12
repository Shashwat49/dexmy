import { query } from "../config/db.js";

// ==========================================
// CREATE QUESTION REPORT
// ==========================================
export const createQuestionReport = async (req, res) => {
  try {
    const { examId, questionId, examTitle, questionText, reason, description } = req.body;
    const studentId = req.user?.id || null;

    if (!examId || !questionId || !reason) {
      return res.status(400).json({ success: false, message: "Exam ID, Question ID, and reason are required" });
    }

    const result = await query(
      `INSERT INTO question_reports (exam_id, question_id, student_id, exam_title, question_text, reason, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [
        String(examId),
        String(questionId),
        studentId,
        examTitle || "",
        questionText || "",
        reason,
        description || ""
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Question report submitted successfully",
      report: result.rows[0],
    });
  } catch (error) {
    console.error("CREATE QUESTION REPORT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to submit question report", error: error.message });
  }
};

// ==========================================
// GET ALL REPORTS
// ==========================================
export const getQuestionReports = async (req, res) => {
  try {
    const result = await query(`SELECT * FROM question_reports ORDER BY created_at DESC`);
    return res.status(200).json({ success: true, reports: result.rows });
  } catch (error) {
    console.error("GET QUESTION REPORTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch question reports", error: error.message });
  }
};

// ==========================================
// GET SINGLE REPORT
// ==========================================
export const getQuestionReportById = async (req, res) => {
  try {
    const result = await query(`SELECT * FROM question_reports WHERE id = $1`, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }
    return res.status(200).json({ success: true, report: result.rows[0] });
  } catch (error) {
    console.error("GET QUESTION REPORT ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch report", error: error.message });
  }
};

// ==========================================
// UPDATE REPORT STATUS
// ==========================================
export const updateQuestionReportStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const normalizedStatus = String(status || "").trim().toLowerCase();
    const allowedStatuses = ["pending", "reviewed", "resolved"];

    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ success: false, message: "Invalid report status" });
    }

    const result = await query(
      `UPDATE question_reports SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [normalizedStatus, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Report status updated successfully",
      report: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE QUESTION REPORT STATUS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update report status", error: error.message });
  }
};
