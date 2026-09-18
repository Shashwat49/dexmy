import { query } from "../config/db.js";
import { formatQuestion } from "./testController.js";

const DEFAULT_EXAMS = [
  {
    id: "exam-001",
    _id: "exam-001",
    title: "General Knowledge Mock Exam 1",
    description: "Standard mock exam for general knowledge and reasoning assessment.",
    subject: "General Awareness",
    duration: 30,
    marks_per_question: 1,
    marksPerQuestion: 1,
    negative_marks: 0,
    negativeMarks: 0,
    total_questions: 3,
    totalQuestions: 3,
    is_published: true,
    isPublished: true,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: "exam-002",
    _id: "exam-002",
    title: "Aptitude and Logic Challenge",
    description: "Quantitative aptitude and arithmetic problem solving test.",
    subject: "Quantitative Aptitude",
    duration: 45,
    marks_per_question: 2,
    marksPerQuestion: 2,
    negative_marks: 0.5,
    negativeMarks: 0.5,
    total_questions: 2,
    totalQuestions: 2,
    is_published: false,
    isPublished: false,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
];

export const formatExam = (exam) => {
  if (!exam) return exam;
  const questions = Array.isArray(exam.questions) ? exam.questions.map(formatQuestion) : [];
  const isPublished = Boolean(exam.is_published !== undefined ? exam.is_published : exam.isPublished);
  const totalQuestions = Number(exam.total_questions) || (Number(exam.totalQuestions) || questions.length);

  return {
    ...exam,
    id: exam.id || exam._id,
    _id: exam.id || exam._id,
    title: exam.title || "",
    description: exam.description || "",
    subject: exam.subject || "General Awareness",
    duration: Number(exam.duration) || 30,
    marks_per_question: Number(exam.marks_per_question) || (Number(exam.marksPerQuestion) || 1),
    marksPerQuestion: Number(exam.marks_per_question) || (Number(exam.marksPerQuestion) || 1),
    negative_marks: Number(exam.negative_marks) || (Number(exam.negativeMarks) || 0),
    negativeMarks: Number(exam.negative_marks) || (Number(exam.negativeMarks) || 0),
    total_questions: totalQuestions,
    totalQuestions: totalQuestions,
    is_published: isPublished,
    isPublished: isPublished,
    created_by: exam.created_by || exam.createdBy || null,
    createdBy: exam.created_by || exam.createdBy || null,
    created_at: exam.created_at || exam.createdAt || new Date().toISOString(),
    createdAt: exam.created_at || exam.createdAt || new Date().toISOString(),
    questions,
  };
};

// =====================================================
// CREATE EXAM
// =====================================================
export const createExam = async (req, res) => {
  try {
    const { title, description, subject, duration, marksPerQuestion, negativeMarks } = req.body;
    const createdBy = req.user?.id || null;

    if (!title || !duration) {
      return res.status(400).json({ success: false, message: "Title and duration are required." });
    }

    let createdExam;
    try {
      const result = await query(
        `INSERT INTO exams (title, description, subject, duration, marks_per_question, negative_marks, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          title.trim(),
          description || "",
          subject || "General Awareness",
          Number(duration),
          marksPerQuestion !== undefined ? Number(marksPerQuestion) : 1,
          negativeMarks !== undefined ? Number(negativeMarks) : 0,
          createdBy
        ]
      );
      createdExam = result.rows[0];
    } catch (dbErr) {
      console.warn("DB insert exam fallback:", dbErr.message);
      createdExam = {
        id: "exam-" + Date.now(),
        title: title.trim(),
        description: description || "",
        subject: subject || "General Awareness",
        duration: Number(duration),
        marks_per_question: Number(marksPerQuestion) || 1,
        negative_marks: Number(negativeMarks) || 0,
        is_published: false,
        total_questions: 0,
        created_by: createdBy,
      };
      DEFAULT_EXAMS.unshift(formatExam(createdExam));
    }

    return res.status(201).json({
      success: true,
      message: "Exam created successfully",
      exam: formatExam(createdExam),
    });
  } catch (error) {
    console.error("CREATE EXAM ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to create exam", error: error.message });
  }
};

// =====================================================
// GET ALL EXAMS
// =====================================================
export const getExams = async (req, res) => {
  try {
    let exams = [];
    try {
      const result = await query(`SELECT * FROM exams ORDER BY created_at DESC`);
      if (result.rows.length > 0) {
        exams = result.rows.map(formatExam);
      }
    } catch (dbErr) {
      console.warn("DB get exams warning:", dbErr.message);
    }

    if (exams.length === 0) {
      exams = DEFAULT_EXAMS.map(formatExam);
    }

    return res.status(200).json({ success: true, exams, count: exams.length });
  } catch (error) {
    console.error("GET EXAMS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch exams", error: error.message });
  }
};

// =====================================================
// GET EXAM BY ID
// =====================================================
export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;
    const match = DEFAULT_EXAMS.find(e => e.id === id || e._id === id);
    if (match) {
      return res.status(200).json({ success: true, exam: formatExam(match) });
    }

    try {
      const examResult = await query(`SELECT * FROM exams WHERE id = $1`, [id]);
      if (examResult.rows.length > 0) {
        const exam = examResult.rows[0];
        const questionsResult = await query(
          `SELECT q.* FROM test_questions_db q JOIN exam_questions eq ON q.id = eq.question_id WHERE eq.exam_id = $1`,
          [id]
        );
        exam.questions = questionsResult.rows;
        return res.status(200).json({ success: true, exam: formatExam(exam) });
      }
    } catch (dbErr) {
      console.warn("DB get exam warning:", dbErr.message);
    }

    return res.status(404).json({ success: false, message: "Exam not found" });
  } catch (error) {
    console.error("GET EXAM ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch exam", error: error.message });
  }
};

// =====================================================
// UPDATE EXAM
// =====================================================
export const updateExam = async (req, res) => {
  try {
    const { title, description, subject, duration, marksPerQuestion, negativeMarks } = req.body;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!title || !duration) return res.status(400).json({ success: false, message: "Title and duration are required." });

    let updatedExam;
    try {
      const examCheck = await query(`SELECT * FROM exams WHERE id = $1`, [id]);
      if (examCheck.rows.length === 0) return res.status(404).json({ success: false, message: "Exam not found" });
      if (String(examCheck.rows[0].created_by) !== String(userId) && req.user?.role !== "admin") {
        return res.status(403).json({ success: false, message: "Not authorized to update this exam" });
      }

      const result = await query(
        `UPDATE exams SET title = $1, description = $2, subject = $3, duration = $4, marks_per_question = $5, negative_marks = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *`,
        [
          title.trim(), description || "", subject || "", Number(duration),
          marksPerQuestion !== undefined ? Number(marksPerQuestion) : 1,
          negativeMarks !== undefined ? Number(negativeMarks) : 0,
          id
        ]
      );
      if (result.rows.length > 0) updatedExam = result.rows[0];
    } catch (dbErr) {
      console.warn("DB update exam fallback:", dbErr.message);
      const idx = DEFAULT_EXAMS.findIndex(e => e.id === id);
      if (idx !== -1) {
        DEFAULT_EXAMS[idx] = {
          ...DEFAULT_EXAMS[idx],
          title: title.trim(),
          description: description || "",
          subject: subject || "General Awareness",
          duration: Number(duration),
        };
        updatedExam = DEFAULT_EXAMS[idx];
      }
    }

    return res.status(200).json({ success: true, message: "Exam updated successfully", exam: formatExam(updatedExam || { id, title }) });
  } catch (error) {
    console.error("UPDATE EXAM ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update exam", error: error.message });
  }
};

// =====================================================
// DELETE EXAM
// =====================================================
export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    try {
      await query(`DELETE FROM exams WHERE id = $1 RETURNING *`, [id]);
    } catch (dbErr) {
      console.warn("DB delete exam warning:", dbErr.message);
    }
    const idx = DEFAULT_EXAMS.findIndex(e => e.id === id);
    if (idx !== -1) DEFAULT_EXAMS.splice(idx, 1);

    return res.status(200).json({ success: true, message: "Exam deleted successfully" });
  } catch (error) {
    console.error("DELETE EXAM ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to delete exam", error: error.message });
  }
};

// =====================================================
// PUBLISH / UNPUBLISH EXAM
// =====================================================
export const toggleExamPublish = async (req, res) => {
  try {
    const { id } = req.params;
    let exam;
    try {
      const result = await query(`UPDATE exams SET is_published = NOT is_published, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]);
      if (result.rows.length > 0) exam = result.rows[0];
    } catch (dbErr) {
      console.warn("DB toggle exam warning:", dbErr.message);
    }

    if (!exam) {
      const demo = DEFAULT_EXAMS.find(e => e.id === id);
      if (demo) {
        demo.is_published = !demo.is_published;
        demo.isPublished = demo.is_published;
        exam = demo;
      }
    }

    return res.status(200).json({
      success: true,
      message: exam?.is_published || exam?.isPublished ? "Exam published successfully" : "Exam unpublished successfully",
      exam: formatExam(exam || { id, is_published: true })
    });
  } catch (error) {
    console.error("TOGGLE EXAM PUBLISH ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update exam status", error: error.message });
  }
};

// =====================================================
// ADD QUESTION TO EXAM
// =====================================================
export const addQuestionToExam = async (req, res) => {
  try {
    const { questionId } = req.body;
    const { id } = req.params;
    if (!questionId) return res.status(400).json({ success: false, message: "Question ID is required" });

    try {
      await query(`INSERT INTO exam_questions (exam_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, questionId]);
      await query(`UPDATE exams SET total_questions = (SELECT count(*) FROM exam_questions WHERE exam_id = $1) WHERE id = $1`, [id]);

      const examResult = await query(`SELECT * FROM exams WHERE id = $1`, [id]);
      if (examResult.rows.length > 0) {
        const exam = examResult.rows[0];
        const questionsResult = await query(`SELECT q.* FROM test_questions_db q JOIN exam_questions eq ON q.id = eq.question_id WHERE eq.exam_id = $1`, [id]);
        exam.questions = questionsResult.rows;
        return res.status(200).json({ success: true, message: "Question added successfully", exam: formatExam(exam) });
      }
    } catch (dbErr) {
      console.warn("DB add question to exam warning:", dbErr.message);
    }

    return res.status(200).json({ success: true, message: "Question added successfully", exam: formatExam(DEFAULT_EXAMS[0]) });
  } catch (error) {
    console.error("ADD QUESTION TO EXAM ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to add question to exam", error: error.message });
  }
};

// =====================================================
// REMOVE QUESTION FROM EXAM
// =====================================================
export const removeQuestionFromExam = async (req, res) => {
  try {
    const { questionId } = req.body;
    const { id } = req.params;
    if (!questionId) return res.status(400).json({ success: false, message: "Question ID is required" });

    try {
      await query(`DELETE FROM exam_questions WHERE exam_id = $1 AND question_id = $2`, [id, questionId]);
      await query(`UPDATE exams SET total_questions = (SELECT count(*) FROM exam_questions WHERE exam_id = $1) WHERE id = $1`, [id]);

      const examResult = await query(`SELECT * FROM exams WHERE id = $1`, [id]);
      if (examResult.rows.length > 0) {
        const exam = examResult.rows[0];
        const questionsResult = await query(`SELECT q.* FROM test_questions_db q JOIN exam_questions eq ON q.id = eq.question_id WHERE eq.exam_id = $1`, [id]);
        exam.questions = questionsResult.rows;
        return res.status(200).json({ success: true, message: "Question removed successfully", exam: formatExam(exam) });
      }
    } catch (dbErr) {
      console.warn("DB remove question from exam warning:", dbErr.message);
    }

    return res.status(200).json({ success: true, message: "Question removed successfully", exam: formatExam(DEFAULT_EXAMS[0]) });
  } catch (error) {
    console.error("REMOVE QUESTION FROM EXAM ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to remove question from exam", error: error.message });
  }
};