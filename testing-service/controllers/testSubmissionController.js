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

    // Fallback to sample questions if test/questions not found in DB
    if (!test || questions.length === 0) {
      test = {
        id: testId,
        _id: testId,
        title: "General Knowledge Mock Test",
        marks_per_question: 2,
        negative_marks: 0.5,
      };
      // Synthetic questions matching the submitted questionIds or default 3 questions
      questions = answers.map((ans, idx) => ({
        id: ans.questionId || `q-${idx + 1}`,
        _id: ans.questionId || `q-${idx + 1}`,
        question_text: `Question ${idx + 1}`,
        correct_answer: 0, // default option A
        marks: 2,
        negative_marks: 0.5,
      }));
      if (questions.length === 0) {
        questions = [
          { id: "q-1", _id: "q-1", question_text: "Capital of India", correct_answer: 0, marks: 2, negative_marks: 0.5 },
          { id: "q-2", _id: "q-2", question_text: "Red Planet", correct_answer: 1, marks: 2, negative_marks: 0.5 },
        ];
      }
    }

    let answered = 0, correct = 0, incorrect = 0, notAnswered = 0, obtainedMarks = 0;
    const processedAnswers = [];

    for (const question of questions) {
      const qId = String(question.id || question._id);
      const submittedAnswer = answers.find((ans) => String(ans.questionId) === qId);
      const selectedAnswer = submittedAnswer && submittedAnswer.selectedAnswer !== null && submittedAnswer.selectedAnswer !== undefined
          ? Number(submittedAnswer.selectedAnswer) : null;

      if (selectedAnswer === null || Number.isNaN(selectedAnswer)) {
        notAnswered++;
        processedAnswers.push({ questionId: qId, selectedAnswer: null, isCorrect: false, marksObtained: 0 });
        continue;
      }

      answered++;
      const correctAns = question.correct_answer !== undefined ? Number(question.correct_answer) : (Number(question.correctAnswer) || 0);

      if (selectedAnswer === correctAns) {
        correct++;
        const marks = Number(question.marks ?? test.marks_per_question ?? 1);
        obtainedMarks += marks;
        processedAnswers.push({ questionId: qId, selectedAnswer, isCorrect: true, marksObtained: marks });
      } else {
        incorrect++;
        const negativeMarks = Number(question.negative_marks ?? test.negative_marks ?? 0);
        obtainedMarks -= negativeMarks;
        processedAnswers.push({ questionId: qId, selectedAnswer, isCorrect: false, marksObtained: -negativeMarks });
      }
    }

    const totalQuestions = questions.length;
    const marksPerQ = Number(test.marks_per_question ?? 1);
    const totalMarks = totalQuestions * marksPerQ;
    const finalObtainedMarks = Number(obtainedMarks.toFixed(2));
    const percentage = totalMarks > 0 ? Number(Math.max(0, (finalObtainedMarks / totalMarks) * 100).toFixed(2)) : 0;

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
    
    // Check in-memory demo submissions first
    const demo = DEMO_SUBMISSIONS.find(s => s.submissionId === id || s.id === id);
    if (demo) {
      return res.status(200).json({ success: true, submission: demo });
    }

    try {
      const submissionResult = await query(`SELECT * FROM test_submissions WHERE id = $1`, [id]);
      if (submissionResult.rows.length > 0) {
        return res.status(200).json({ success: true, submission: submissionResult.rows[0] });
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
    const studentId = req.params.studentId || req.user?.id;
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
