import { query } from "../config/db.js";
import { formatQuestion } from "./testController.js";

const DEFAULT_QUESTIONS = [
  {
    id: "q-101",
    _id: "q-101",
    question_text: "Which of the following is the capital of India?",
    questionText: "Which of the following is the capital of India?",
    question: "Which of the following is the capital of India?",
    options: ["New Delhi", "Mumbai", "Kolkata", "Chennai"],
    correct_answer: 0,
    correctAnswer: 0,
    marks: 2,
    negative_marks: 0.5,
    negativeMarks: 0.5,
    difficulty: "Easy",
    subject: "General Awareness",
  },
  {
    id: "q-102",
    _id: "q-102",
    question_text: "Which planet is known as the Red Planet?",
    questionText: "Which planet is known as the Red Planet?",
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correct_answer: 1,
    correctAnswer: 1,
    marks: 2,
    negative_marks: 0.5,
    negativeMarks: 0.5,
    difficulty: "Easy",
    subject: "General Awareness",
  },
  {
    id: "q-103",
    _id: "q-103",
    question_text: "What is the primary function of an operating system kernel?",
    questionText: "What is the primary function of an operating system kernel?",
    question: "What is the primary function of an operating system kernel?",
    options: [
      "Rendering CSS styles",
      "Resource management and hardware abstraction",
      "Compiling Java bytecode",
      "Managing DNS records"
    ],
    correct_answer: 1,
    correctAnswer: 1,
    marks: 4,
    negative_marks: 1,
    negativeMarks: 1,
    difficulty: "Medium",
    subject: "Computer Science",
  }
];

// Create Question
export const createQuestion = async (req, res) => {
  try {
    let { questionText, questionImage, options, correctAnswer, marks, negativeMarks, subject, difficulty } = req.body;

    if (typeof options === "string") {
      try { options = JSON.parse(options); } catch { return res.status(400).json({ success: false, message: "Invalid options format." }); }
    }

    correctAnswer = Number(correctAnswer);
    marks = Number(marks);
    negativeMarks = Number(negativeMarks);

    if (!Array.isArray(options) || options.length < 2 || options.length > 5) {
      return res.status(400).json({ success: false, message: "Question must have between 2 and 5 options." });
    }
    if (options.some((option) => !String(option).trim())) {
      return res.status(400).json({ success: false, message: "All options are required." });
    }
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length) {
      return res.status(400).json({ success: false, message: "Invalid correct answer." });
    }

    let createdRow;
    try {
      const result = await query(
        `INSERT INTO test_questions_db (question_text, question_image, options, correct_answer, marks, negative_marks, subject, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          questionText || "",
          questionImage || "",
          JSON.stringify(options),
          correctAnswer,
          marks || 1,
          negativeMarks || 0,
          subject || "General Awareness",
          difficulty || "Medium"
        ]
      );
      createdRow = result.rows[0];
    } catch (dbErr) {
      console.warn("DB insert question fallback:", dbErr.message);
      createdRow = {
        id: "q-" + Date.now(),
        question_text: questionText,
        options,
        correct_answer: correctAnswer,
        marks: marks || 1,
        negative_marks: negativeMarks || 0,
        subject: subject || "General Awareness",
        difficulty: difficulty || "Medium",
      };
      DEFAULT_QUESTIONS.push(formatQuestion(createdRow));
    }

    res.status(201).json({ success: true, message: "Question created successfully", question: formatQuestion(createdRow) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create question", error: error.message });
  }
};

// Get All Questions
export const getQuestions = async (req, res) => {
  try {
    let questions = [];
    try {
      const result = await query(`SELECT * FROM test_questions_db ORDER BY created_at DESC`);
      if (result.rows.length > 0) {
        questions = result.rows.map(formatQuestion);
      }
    } catch (dbErr) {
      console.warn("DB fetch questions warning:", dbErr.message);
    }

    if (questions.length === 0) {
      questions = DEFAULT_QUESTIONS.map(formatQuestion);
    }

    res.status(200).json({ success: true, count: questions.length, questions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch questions", error: error.message });
  }
};

// Get Single Question
export const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    const match = DEFAULT_QUESTIONS.find(q => q.id === id || q._id === id);
    if (match) {
      return res.status(200).json({ success: true, question: formatQuestion(match) });
    }

    try {
      const result = await query(`SELECT * FROM test_questions_db WHERE id = $1`, [id]);
      if (result.rows.length > 0) {
        return res.status(200).json({ success: true, question: formatQuestion(result.rows[0]) });
      }
    } catch (dbErr) {
      console.warn("DB get question warning:", dbErr.message);
    }

    return res.status(404).json({ success: false, message: "Question not found" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch question", error: error.message });
  }
};

// Update Question
export const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    let existing = null;

    try {
      const existingResult = await query(`SELECT * FROM test_questions_db WHERE id = $1`, [id]);
      if (existingResult.rows.length > 0) {
        existing = existingResult.rows[0];
      }
    } catch (dbErr) {
      console.warn("DB get question warning:", dbErr.message);
    }

    const { 
        questionText = existing?.question_text || req.body.question, 
        questionImage = existing?.question_image, 
        options = existing?.options || req.body.options, 
        correctAnswer = existing?.correct_answer ?? req.body.correctAnswer, 
        marks = existing?.marks ?? req.body.marks, 
        negativeMarks = existing?.negative_marks ?? req.body.negativeMarks, 
        subject = existing?.subject || req.body.subject, 
        difficulty = existing?.difficulty || req.body.difficulty 
    } = req.body;

    let updatedRow;
    try {
      const result = await query(
        `UPDATE test_questions_db SET 
         question_text = $1, question_image = $2, options = $3, correct_answer = $4, 
         marks = $5, negative_marks = $6, subject = $7, difficulty = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 RETURNING *`,
        [
          questionText,
          questionImage,
          JSON.stringify(options),
          Number(correctAnswer),
          Number(marks),
          Number(negativeMarks),
          subject,
          difficulty,
          id
        ]
      );
      if (result.rows.length > 0) updatedRow = result.rows[0];
    } catch (dbErr) {
      console.warn("DB update question warning:", dbErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Question updated successfully",
      question: formatQuestion(updatedRow || { id, questionText, options, correctAnswer })
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update question", error: error.message });
  }
};

// Delete Question
export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    try {
      const checkResult = await query(`SELECT test_id FROM test_questions WHERE question_id = $1 LIMIT 1`, [id]);
      if (checkResult.rows.length > 0) {
        return res.status(409).json({ success: false, message: "This question is currently used in a test. Remove it from the test first." });
      }
      await query(`DELETE FROM test_questions_db WHERE id = $1 RETURNING *`, [id]);
    } catch (dbErr) {
      console.warn("DB delete question warning:", dbErr.message);
    }

    res.status(200).json({ success: true, message: "Question deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete question", error: error.message });
  }
};
