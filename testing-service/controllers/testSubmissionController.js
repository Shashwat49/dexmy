import { query } from "../config/db.js";
import { getTestById } from "./testController.js";

// In-memory submissions fallback for dev/demo testing
const DEMO_SUBMISSIONS = [];

export const submitTest = async (req, res) => {
  try {
    const { testId, answers } = req.body;
    const studentId = req.user?.id || "00000000-0000-0000-0000-000000000001";

    if (!testId) return res.status(400).json({ success: false, message: "Test ID is required" });
    if (!Array.isArray(answers)) return res.status(400).json({ success: false, message: "Answers must be an array" });

    let test = null;
    let questions = [];

    // Try DB first
    try {
      const testResult = await query(`SELECT * FROM tests WHERE id = $1`, [testId]);
      if (testResult.rows.length > 0) {
        test = testResult.rows[0];
        const questionsResult = await query(
          `SELECT q.* FROM test_questions_db q JOIN test_questions tq ON q.id = tq.question_id WHERE tq.test_id = $1`,
          [testId]
        );
        questions = questionsResult.rows;
      }
    } catch (dbErr) {
      console.warn("DB fetch warning in submitTest:", dbErr.message);
    }

    // A real test must be backed by a real test record and its assigned questions.
    // Never manufacture questions during scoring: doing so can produce incorrect marks
    // when a test exists but its question join/query is incomplete.
    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    if (questions.length === 0) {
      return res.status(400).json({ success: false, message: "This test has no questions to score" });
    }

    let answered = 0, correct = 0, incorrect = 0, notAnswered = 0, obtainedMarks = 0;
    const processedAnswers = [];

    for (const question of questions) {
      const qId = String(question.id || question._id);
      const submittedAnswer = answers.find((ans) => String(ans.questionId) === qId);
      const rawSelectedAnswer = submittedAnswer?.selectedAnswer;
      const selectedAnswer =
        rawSelectedAnswer === null ||
        rawSelectedAnswer === undefined ||
        rawSelectedAnswer === ""
          ? null
          : Number(rawSelectedAnswer);

      // Keep the full question context in the result payload so the result page
      // can render the actual question, options, and correct answer. Previously
      // only questionId was returned, which caused "Question not available".
      let questionOptions = question.options;
      if (typeof questionOptions === "string") {
        try {
          questionOptions = JSON.parse(questionOptions);
        } catch {
          questionOptions = [];
        }
      }
      if (!Array.isArray(questionOptions)) questionOptions = [];

      const questionDetails = {
        id: question.id || question._id,
        _id: question._id || question.id,
        questionText: question.question_text || question.questionText || question.question || "",
        question: question.question_text || question.questionText || question.question || "",
        options: questionOptions,
        correctAnswer: Number(question.correct_answer ?? question.correctAnswer ?? 0),
        media: question.question_image || question.questionImage || null,
      };

      if (selectedAnswer === null || Number.isNaN(selectedAnswer)) {
        notAnswered++;
        processedAnswers.push({
          questionId: qId,
          selectedAnswer: null,
          isCorrect: false,
          marksObtained: 0,
          question: questionDetails,
        });
        continue;
      }

      if (!Number.isInteger(selectedAnswer)) {
        return res.status(400).json({
          success: false,
          message: `Invalid selected answer for question ${qId}`,
        });
      }

      answered++;
      const rawCorrectAnswer =
        question.correct_answer !== undefined
          ? question.correct_answer
          : question.correctAnswer;
      const correctAns = Number(rawCorrectAnswer);

      if (!Number.isInteger(correctAns)) {
        return res.status(500).json({
          success: false,
          message: `Question ${qId} has an invalid correct answer configuration`,
        });
      }

      const questionMarks = Number(question.marks);
      const testMarks = Number(test.marks_per_question);
      const marks = Number.isFinite(questionMarks) && questionMarks >= 0
        ? questionMarks
        : (Number.isFinite(testMarks) && testMarks >= 0 ? testMarks : 1);

      const questionNegativeMarks = Number(question.negative_marks);
      const testNegativeMarks = Number(test.negative_marks);
      const negativeMarks = Number.isFinite(questionNegativeMarks) && questionNegativeMarks >= 0
        ? questionNegativeMarks
        : (Number.isFinite(testNegativeMarks) && testNegativeMarks >= 0 ? testNegativeMarks : 0);

      if (selectedAnswer === correctAns) {
        correct++;
        obtainedMarks += marks;
        processedAnswers.push({
          questionId: qId,
          selectedAnswer,
          isCorrect: true,
          marksObtained: marks,
          question: questionDetails,
        });
      } else {
        incorrect++;
        obtainedMarks -= negativeMarks;
        processedAnswers.push({
          questionId: qId,
          selectedAnswer,
          isCorrect: false,
          marksObtained: -negativeMarks,
          question: questionDetails,
        });
      }
    }

    const totalQuestions = questions.length;
    const totalMarks = questions.reduce((sum, question) => {
      const questionMarks = Number(question.marks);
      const testMarks = Number(test.marks_per_question);
      const marks = Number.isFinite(questionMarks) && questionMarks >= 0
        ? questionMarks
        : (Number.isFinite(testMarks) && testMarks >= 0 ? testMarks : 1);
      return sum + marks;
    }, 0);
    const finalObtainedMarks = Number(obtainedMarks.toFixed(2));
    const percentage = totalMarks > 0
      ? Number(Math.min(100, Math.max(0, (finalObtainedMarks / totalMarks) * 100)).toFixed(2))
      : 0;

    let submissionId = "sub-" + Date.now();

    try {
      const submissionResult = await query(
        `INSERT INTO test_submissions 
         (test_id, student_id, answers, total_questions, answered, correct, incorrect, not_answered, total_marks, obtained_marks, percentage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          testId, studentId, JSON.stringify(processedAnswers), totalQuestions, answered, correct, incorrect, notAnswered,
          totalMarks, finalObtainedMarks, percentage
        ]
      );
      if (submissionResult.rows.length > 0) {
        submissionId = submissionResult.rows[0].id;
      }
    } catch (dbErr) {
      console.warn("DB insert warning in submitTest, storing in memory:", dbErr.message);
    }

    const resultPayload = {
      submissionId,
      testId: test.id || testId,
      testTitle: test.title || "Test",
      studentId,
      totalQuestions,
      answered,
      correct,
      incorrect,
      notAnswered,
      totalMarks,
      obtainedMarks: finalObtainedMarks,
      percentage,
      answers: processedAnswers,
      createdAt: new Date().toISOString(),
    };

    DEMO_SUBMISSIONS.push(resultPayload);

    return res.status(201).json({
      success: true,
      message: "Test submitted successfully",
      result: resultPayload,
      submission: resultPayload,
    });
  } catch (error) {
    console.error("SUBMIT TEST ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to submit test", error: error.message });
  }
};

export const getSubmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = String(req.user?.id || "");
    const privileged = ["admin", "super_admin", "test_creator"].includes(req.user?.role);

    // Check in-memory demo submissions first.
    const demo = DEMO_SUBMISSIONS.find(s => s.submissionId === id || s.id === id);
    if (demo) {
      if (!privileged && String(demo.studentId) !== requesterId) {
        return res.status(403).json({ success: false, message: "Not authorized to view this submission" });
      }
      return res.status(200).json({ success: true, submission: demo });
    }

    try {
      const submissionResult = await query(`SELECT * FROM test_submissions WHERE id = $1`, [id]);
      if (submissionResult.rows.length > 0) {
        const submission = submissionResult.rows[0];
        if (!privileged && String(submission.student_id) !== requesterId) {
          return res.status(403).json({ success: false, message: "Not authorized to view this submission" });
        }
        return res.status(200).json({ success: true, submission });
      }
    } catch (dbErr) {
      console.warn("DB get submission warning:", dbErr.message);
    }
    
    return res.status(404).json({ success: false, message: "Submission not found" });
  } catch (error) {
    console.error("GET SUBMISSION ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch submission", error: error.message });
  }
};

export const getStudentSubmissions = async (req, res) => {
  try {
    const requestedStudentId = req.params.studentId;
    const requesterId = String(req.user?.id || "");
    const privileged = ["admin", "super_admin", "test_creator"].includes(req.user?.role);

    if (requestedStudentId && !privileged && String(requestedStudentId) !== requesterId) {
      return res.status(403).json({ success: false, message: "Not authorized to view these submissions" });
    }

    const studentId = requestedStudentId || req.user?.id;
    let submissions = [];

    try {
      const result = await query(
        `SELECT ts.*, t.title as test_title FROM test_submissions ts 
         LEFT JOIN tests t ON ts.test_id = t.id 
         WHERE ts.student_id = $1 ORDER BY ts.created_at DESC`,
        [studentId]
      );
      submissions = result.rows;
    } catch (dbErr) {
      console.warn("DB get student submissions warning:", dbErr.message);
    }

    if (submissions.length === 0) {
      submissions = DEMO_SUBMISSIONS.filter(s => !studentId || s.studentId === studentId);
    }

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    console.error("GET STUDENT SUBMISSIONS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch student submissions", error: error.message });
  }
};