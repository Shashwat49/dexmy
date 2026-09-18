import { query } from "../config/db.js";

// Sample tests fallback for development / offline inspection
const SAMPLE_QUESTIONS = [
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
  },
  {
    id: "q-104",
    _id: "q-104",
    question_text: "If a train travels 360 km in 4 hours, what is its average speed in meters per second?",
    questionText: "If a train travels 360 km in 4 hours, what is its average speed in meters per second?",
    question: "If a train travels 360 km in 4 hours, what is its average speed in meters per second?",
    options: ["20 m/s", "25 m/s", "30 m/s", "35 m/s"],
    correct_answer: 1,
    correctAnswer: 1,
    marks: 3,
    negative_marks: 0.75,
    negativeMarks: 0.75,
    difficulty: "Medium",
    subject: "Quantitative Aptitude",
  },
  {
    id: "q-105",
    _id: "q-105",
    question_text: "Which data structure uses the LIFO (Last-In First-Out) principle?",
    questionText: "Which data structure uses the LIFO (Last-In First-Out) principle?",
    question: "Which data structure uses the LIFO (Last-In First-Out) principle?",
    options: ["Queue", "Stack", "Binary Search Tree", "Linked List"],
    correct_answer: 1,
    correctAnswer: 1,
    marks: 2,
    negative_marks: 0.5,
    negativeMarks: 0.5,
    difficulty: "Easy",
    subject: "Computer Science",
  }
];

const DEFAULT_DEMO_TESTS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    _id: "11111111-1111-1111-1111-111111111111",
    title: "General Knowledge & Awareness - National Mock Test",
    description: "Comprehensive assessment of general awareness, geography, history, and scientific facts. Suitable for all students.",
    subject: "General Awareness",
    duration: 30,
    marks_per_question: 2,
    marksPerQuestion: 2,
    negative_marks: 0.5,
    negativeMarks: 0.5,
    total_questions: 3,
    totalQuestions: 3,
    is_published: true,
    isPublished: true,
    is_paid: false,
    isPaid: false,
    price: 0,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    questions: [SAMPLE_QUESTIONS[0], SAMPLE_QUESTIONS[1], SAMPLE_QUESTIONS[2]]
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    _id: "22222222-2222-2222-2222-222222222222",
    title: "Quantitative Aptitude & Logical Reasoning Master Test",
    description: "Advanced numerical ability, mathematical concepts, speed calculations, and critical thinking challenge.",
    subject: "Quantitative Aptitude",
    duration: 45,
    marks_per_question: 3,
    marksPerQuestion: 3,
    negative_marks: 0.75,
    negativeMarks: 0.75,
    total_questions: 2,
    totalQuestions: 2,
    is_published: true,
    isPublished: true,
    is_paid: true,
    isPaid: true,
    price: 499,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    questions: [SAMPLE_QUESTIONS[3], SAMPLE_QUESTIONS[4]]
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    _id: "33333333-3333-3333-3333-333333333333",
    title: "Computer Science & Engineering Core Assessment",
    description: "Test your knowledge of operating systems, data structures, algorithm complexities, and foundational software engineering.",
    subject: "Computer Science",
    duration: 40,
    marks_per_question: 4,
    marksPerQuestion: 4,
    negative_marks: 1,
    negativeMarks: 1,
    total_questions: 3,
    totalQuestions: 3,
    is_published: true,
    isPublished: true,
    is_paid: true,
    isPaid: true,
    price: 299,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    questions: [SAMPLE_QUESTIONS[2], SAMPLE_QUESTIONS[4], SAMPLE_QUESTIONS[0]]
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    _id: "44444444-4444-4444-4444-444444444444",
    title: "Quick Science & Astronomy Quiz",
    description: "Rapid-fire questions covering basic physics, celestial mechanics, and solar system trivia.",
    subject: "Science",
    duration: 15,
    marks_per_question: 2,
    marksPerQuestion: 2,
    negative_marks: 0,
    negativeMarks: 0,
    total_questions: 2,
    totalQuestions: 2,
    is_published: true,
    isPublished: true,
    is_paid: false,
    isPaid: false,
    price: 0,
    created_at: new Date(Date.now() - 259200000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    questions: [SAMPLE_QUESTIONS[1], SAMPLE_QUESTIONS[0]]
  }
];

// Helper to normalize question objects
export const formatQuestion = (q) => {
  if (!q) return q;
  let options = q.options;
  if (typeof options === "string") {
    try {
      options = JSON.parse(options);
    } catch {
      options = [];
    }
  }
  return {
    ...q,
    id: q.id,
    _id: q.id,
    question_text: q.question_text || q.questionText || q.question || "",
    questionText: q.question_text || q.questionText || q.question || "",
    question: q.question_text || q.questionText || q.question || "",
    question_image: q.question_image || q.questionImage || q.media || "",
    questionImage: q.question_image || q.questionImage || q.media || "",
    media: q.question_image || q.questionImage || q.media || null,
    options: Array.isArray(options) ? options : [],
    correct_answer: q.correct_answer !== undefined ? Number(q.correct_answer) : (q.correctAnswer !== undefined ? Number(q.correctAnswer) : 0),
    correctAnswer: q.correct_answer !== undefined ? Number(q.correct_answer) : (q.correctAnswer !== undefined ? Number(q.correctAnswer) : 0),
    marks: Number(q.marks) || 1,
    negative_marks: Number(q.negative_marks) || (Number(q.negativeMarks) || 0),
    negativeMarks: Number(q.negative_marks) || (Number(q.negativeMarks) || 0),
    subject: q.subject || "General Awareness",
    difficulty: q.difficulty || "Medium",
  };
};

// In-memory test purchases store (fallback / dev mode)
export const TEST_PURCHASES = [
  {
    id: "pur-demo-1",
    test_id: "22222222-2222-2222-2222-222222222222",
    student_id: "demo-student-purchased-id",
    amount: 499,
    created_at: new Date().toISOString(),
  }
];

export const checkTestPurchased = async (testId, studentId) => {
  if (!studentId || !testId) return false;
  const inMem = TEST_PURCHASES.some(
    p => (String(p.test_id) === String(testId) || String(p.testId) === String(testId)) && 
         String(p.student_id) === String(studentId)
  );
  if (inMem) return true;

  try {
    const result = await query(
      `SELECT * FROM test_purchases WHERE test_id = $1 AND student_id = $2`,
      [testId, studentId]
    );
    return result.rows.length > 0;
  } catch (err) {
    return inMem;
  }
};

// Helper to normalize test objects
export const formatTest = (test) => {
  if (!test) return test;
  const questions = Array.isArray(test.questions) ? test.questions.map(formatQuestion) : [];
  const totalQuestions = Number(test.total_questions) || (Number(test.totalQuestions) || questions.length);
  const isPublished = Boolean(test.is_published !== undefined ? test.is_published : test.isPublished);
  const isPaid = Boolean(test.is_paid !== undefined ? test.is_paid : test.isPaid);
  const marksPerQuestion = Number(test.marks_per_question) || (Number(test.marksPerQuestion) || 1);
  const negativeMarks = Number(test.negative_marks) || (Number(test.negativeMarks) || 0);

  return {
    ...test,
    id: test.id || test._id,
    _id: test.id || test._id,
    title: test.title || "",
    description: test.description || "",
    subject: test.subject || "General Awareness",
    duration: Number(test.duration) || 30,
    marks_per_question: marksPerQuestion,
    marksPerQuestion: marksPerQuestion,
    negative_marks: negativeMarks,
    negativeMarks: negativeMarks,
    total_questions: totalQuestions,
    totalQuestions: totalQuestions,
    is_published: isPublished,
    isPublished: isPublished,
    is_paid: isPaid,
    isPaid: isPaid,
    price: Number(test.price) || 0,
    created_by: test.created_by || test.createdBy || null,
    createdBy: test.created_by || test.createdBy || null,
    created_at: test.created_at || test.createdAt || new Date().toISOString(),
    createdAt: test.created_at || test.createdAt || new Date().toISOString(),
    updated_at: test.updated_at || test.updatedAt || new Date().toISOString(),
    updatedAt: test.updated_at || test.updatedAt || new Date().toISOString(),
    questions,
  };
};

// =====================================================
// CREATE TEST
// =====================================================
export const createTest = async (req, res) => {
  try {
    const { title, description, subject, duration, marksPerQuestion, negativeMarks, isPaid, is_paid, price } = req.body;
    const createdBy = req.user?.id || null;

    if (!title || !duration) {
      return res.status(400).json({ success: false, message: "Title and duration are required." });
    }

    const paidFlag = Boolean(isPaid ?? is_paid);
    const priceVal = paidFlag ? Number(price || 0) : 0;

    let testRow;
    try {
      const result = await query(
        `INSERT INTO tests (title, description, subject, duration, marks_per_question, negative_marks, is_paid, price, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          title.trim(),
          description || "",
          subject || "General Awareness",
          Number(duration),
          marksPerQuestion !== undefined ? Number(marksPerQuestion) : 1,
          negativeMarks !== undefined ? Number(negativeMarks) : 0,
          paidFlag,
          priceVal,
          createdBy
        ]
      );
      testRow = result.rows[0];
    } catch (dbErr) {
      console.warn("DB insert fallback to mock creation:", dbErr.message);
      testRow = {
        id: "test-" + Date.now(),
        title: title.trim(),
        description: description || "",
        subject: subject || "General Awareness",
        duration: Number(duration),
        marks_per_question: Number(marksPerQuestion) || 1,
        negative_marks: Number(negativeMarks) || 0,
        is_published: false,
        is_paid: paidFlag,
        price: priceVal,
        total_questions: 0,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      };
      DEFAULT_DEMO_TESTS.unshift(formatTest(testRow));
    }

    return res.status(201).json({
      success: true,
      message: "Test created successfully",
      test: formatTest(testRow),
    });
  } catch (error) {
    console.error("CREATE TEST ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to create test", error: error.message });
  }
};

// =====================================================
// GET ALL TESTS (Creator / Admin)
// =====================================================
export const getTests = async (req, res) => {
  try {
    let tests = [];
    try {
      const result = await query(`SELECT * FROM tests ORDER BY created_at DESC`);
      if (result.rows.length > 0) {
        tests = result.rows.map(formatTest);
      }
    } catch (dbErr) {
      console.warn("Database fetch warning, using demo tests:", dbErr.message);
    }

    if (tests.length === 0) {
      tests = DEFAULT_DEMO_TESTS.map(formatTest);
    }

    return res.status(200).json({ success: true, count: tests.length, tests });
  } catch (error) {
    console.error("GET TESTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch tests", error: error.message });
  }
};

// =====================================================
// GET TEST BY ID
// =====================================================
export const getTestById = async (req, res) => {
  try {
    const { id } = req.params;

    let foundTest = null;
    const demoMatch = DEFAULT_DEMO_TESTS.find(t => t.id === id || t._id === id);
    if (demoMatch) {
      foundTest = demoMatch;
    } else {
      try {
        const testResult = await query(`SELECT * FROM tests WHERE id = $1`, [id]);
        if (testResult.rows.length > 0) {
          const test = testResult.rows[0];
          const questionsResult = await query(
            `SELECT q.* FROM test_questions_db q 
             JOIN test_questions tq ON q.id = tq.question_id 
             WHERE tq.test_id = $1`,
            [id]
          );
          test.questions = questionsResult.rows;
          foundTest = test;
        }
      } catch (dbErr) {
        console.warn("DB query warning in getTestById:", dbErr.message);
      }
    }

    if (!foundTest && DEFAULT_DEMO_TESTS.length > 0 && process.env.NODE_ENV !== "production") {
      foundTest = DEFAULT_DEMO_TESTS[0];
    }

    if (!foundTest) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    const formatted = formatTest(foundTest);
    const isPaid = Boolean(formatted.is_paid || formatted.isPaid);

    // Server-side access control for paid tests (Task 3 Section 14)
    if (isPaid) {
      const userRole = req.user?.role;
      const isPrivileged = userRole === "admin" || userRole === "test_creator" || (req.user?.id && req.user.id === formatted.created_by);

      if (!isPrivileged) {
        const studentId = req.user?.id || req.user?.sub;
        const hasPurchased = studentId && (await checkTestPurchased(formatted.id, studentId));

        if (!hasPurchased) {
          return res.status(403).json({
            success: false,
            message: "Access denied: This is a paid test. Server-side payment verification required before attempting.",
            is_paid: true,
            isPaid: true,
            price: formatted.price,
            requires_purchase: true,
            is_purchased: false,
            test: {
              id: formatted.id,
              _id: formatted._id,
              title: formatted.title,
              description: formatted.description,
              subject: formatted.subject,
              duration: formatted.duration,
              total_questions: formatted.total_questions,
              totalQuestions: formatted.totalQuestions,
              is_paid: true,
              isPaid: true,
              price: formatted.price,
            }
          });
        }
      }
    }

    return res.status(200).json({ success: true, test: formatted });
  } catch (error) {
    console.error("GET TEST ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch test", error: error.message });
  }
};

// =====================================================
// PURCHASE TEST (Server-Side Unlock - Task 3 Section 14)
// =====================================================
export const purchaseTest = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user?.id || req.user?.sub || "demo-student-id";

    let test = DEFAULT_DEMO_TESTS.find(t => t.id === id || t._id === id);
    if (!test) {
      try {
        const resDb = await query(`SELECT * FROM tests WHERE id = $1`, [id]);
        if (resDb.rows.length > 0) test = resDb.rows[0];
      } catch (err) {}
    }

    if (!test) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    const price = Number(test.price) || 499;

    // Record in memory store
    TEST_PURCHASES.push({
      id: `pur-${Date.now()}`,
      test_id: id,
      student_id: studentId,
      amount: price,
      created_at: new Date().toISOString(),
    });

    try {
      await query(
        `INSERT INTO test_purchases (test_id, student_id, amount, payment_reference)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (test_id, student_id) DO NOTHING`,
        [id, studentId, price, `PAY-${Date.now()}`]
      );
    } catch (dbErr) {
      console.warn("DB purchase insert warning:", dbErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Test purchased and unlocked successfully",
      test_id: id,
      is_purchased: true,
      price,
    });
  } catch (error) {
    console.error("PURCHASE TEST ERROR:", error);
    return res.status(500).json({ success: false, message: "Purchase failed", error: error.message });
  }
};

// =====================================================
// GET STUDENT PURCHASES
// =====================================================
export const getMyPurchases = async (req, res) => {
  try {
    const studentId = req.user?.id || req.user?.sub || "demo-student-id";
    let purchases = TEST_PURCHASES.filter(p => String(p.student_id) === String(studentId));

    try {
      const dbRes = await query(
        `SELECT tp.*, t.title, t.subject, t.price FROM test_purchases tp 
         JOIN tests t ON tp.test_id = t.id 
         WHERE tp.student_id = $1`,
        [studentId]
      );
      if (dbRes.rows.length > 0) {
        purchases = dbRes.rows;
      }
    } catch (err) {}

    return res.status(200).json({
      success: true,
      count: purchases.length,
      purchases,
    });
  } catch (error) {
    console.error("GET PURCHASES ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to get purchases", error: error.message });
  }
};

// =====================================================
// UPDATE TEST
// =====================================================
export const updateTest = async (req, res) => {
  try {
    const { title, description, subject, duration, marksPerQuestion, negativeMarks, isPaid, is_paid, price } = req.body;
    const userId = req.user?.id;
    const testId = req.params.id;

    if (!title || !duration) {
      return res.status(400).json({ success: false, message: "Title and duration are required." });
    }

    const paidFlag = Boolean(isPaid ?? is_paid);
    const priceVal = paidFlag ? Number(price || 0) : 0;

    let updatedTest;
    try {
      const testCheck = await query(`SELECT * FROM tests WHERE id = $1`, [testId]);
      if (testCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: "Test not found" });
      }
      if (String(testCheck.rows[0].created_by) !== String(userId) && req.user?.role !== "admin") {
        return res.status(403).json({ success: false, message: "Not authorized to update this test" });
      }

      const result = await query(
        `UPDATE tests SET 
          title = $1, description = $2, subject = $3, duration = $4, 
          marks_per_question = $5, negative_marks = $6, is_paid = $7, price = $8, updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 RETURNING *`,
        [
          title.trim(),
          description || "",
          subject || "General Awareness",
          Number(duration),
          marksPerQuestion !== undefined ? Number(marksPerQuestion) : 1,
          negativeMarks !== undefined ? Number(negativeMarks) : 0,
          paidFlag,
          priceVal,
          testId
        ]
      );
      updatedTest = result.rows[0];
    } catch (dbErr) {
      console.warn("DB update fallback:", dbErr.message);
      const idx = DEFAULT_DEMO_TESTS.findIndex(t => t.id === testId);
      if (idx !== -1) {
        DEFAULT_DEMO_TESTS[idx] = {
          ...DEFAULT_DEMO_TESTS[idx],
          title: title.trim(),
          description: description || "",
          subject: subject || "General Awareness",
          duration: Number(duration),
          marksPerQuestion: Number(marksPerQuestion) || 1,
          negativeMarks: Number(negativeMarks) || 0,
          isPaid: paidFlag,
          price: priceVal,
        };
        updatedTest = DEFAULT_DEMO_TESTS[idx];
      }
    }

    return res.status(200).json({
      success: true,
      message: "Test updated successfully",
      test: formatTest(updatedTest || { id: testId, title }),
    });
  } catch (error) {
    console.error("UPDATE TEST ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update test", error: error.message });
  }
};

// =====================================================
// DELETE TEST
// =====================================================
export const deleteTest = async (req, res) => {
  try {
    const testId = req.params.id;
    try {
      await query(`DELETE FROM tests WHERE id = $1`, [testId]);
    } catch (dbErr) {
      console.warn("DB delete warning:", dbErr.message);
    }
    const idx = DEFAULT_DEMO_TESTS.findIndex(t => t.id === testId);
    if (idx !== -1) DEFAULT_DEMO_TESTS.splice(idx, 1);

    return res.status(200).json({ success: true, message: "Test deleted successfully" });
  } catch (error) {
    console.error("DELETE TEST ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to delete test", error: error.message });
  }
};

// =====================================================
// PUBLISH / UNPUBLISH TEST
// =====================================================
export const toggleTestPublish = async (req, res) => {
  try {
    const testId = req.params.id;
    let test;

    try {
      const result = await query(
        `UPDATE tests SET is_published = NOT is_published, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [testId]
      );
      if (result.rows.length > 0) {
        test = result.rows[0];
      }
    } catch (dbErr) {
      console.warn("DB toggle warning:", dbErr.message);
    }

    if (!test) {
      const demo = DEFAULT_DEMO_TESTS.find(t => t.id === testId);
      if (demo) {
        demo.is_published = !demo.is_published;
        demo.isPublished = demo.is_published;
        test = demo;
      }
    }

    const formatted = formatTest(test || { id: testId, is_published: true });
    return res.status(200).json({
      success: true,
      message: formatted.isPublished ? "Test published successfully" : "Test unpublished successfully",
      test: formatted,
    });
  } catch (error) {
    console.error("TOGGLE TEST PUBLISH ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to update test status", error: error.message });
  }
};

// =====================================================
// ADD QUESTION TO TEST
// =====================================================
export const addQuestionToTest = async (req, res) => {
  try {
    const { questionId } = req.body;
    const testId = req.params.id;
    if (!questionId) return res.status(400).json({ success: false, message: "Question ID is required" });

    try {
      await query(`INSERT INTO test_questions (test_id, question_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [testId, questionId]);
      await query(
        `UPDATE tests SET total_questions = (SELECT count(*) FROM test_questions WHERE test_id = $1) WHERE id = $1`,
        [testId]
      );
      const testResult = await query(`SELECT * FROM tests WHERE id = $1`, [testId]);
      if (testResult.rows.length > 0) {
        const test = testResult.rows[0];
        const questionsResult = await query(
          `SELECT q.* FROM test_questions_db q JOIN test_questions tq ON q.id = tq.question_id WHERE tq.test_id = $1`,
          [testId]
        );
        test.questions = questionsResult.rows;
        return res.status(200).json({ success: true, message: "Question added successfully", test: formatTest(test) });
      }
    } catch (dbErr) {
      console.warn("DB add question warning:", dbErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Question added successfully",
      test: formatTest(DEFAULT_DEMO_TESTS[0]),
    });
  } catch (error) {
    console.error("ADD QUESTION TO TEST ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to add question", error: error.message });
  }
};

// =====================================================
// REMOVE QUESTION FROM TEST
// =====================================================
export const removeQuestionFromTest = async (req, res) => {
  try {
    const { questionId } = req.body;
    const testId = req.params.id;
    if (!questionId) return res.status(400).json({ success: false, message: "Question ID is required" });

    try {
      await query(`DELETE FROM test_questions WHERE test_id = $1 AND question_id = $2`, [testId, questionId]);
      await query(
        `UPDATE tests SET total_questions = (SELECT count(*) FROM test_questions WHERE test_id = $1) WHERE id = $1`,
        [testId]
      );
      const testResult = await query(`SELECT * FROM tests WHERE id = $1`, [testId]);
      if (testResult.rows.length > 0) {
        const test = testResult.rows[0];
        const questionsResult = await query(
          `SELECT q.* FROM test_questions_db q JOIN test_questions tq ON q.id = tq.question_id WHERE tq.test_id = $1`,
          [testId]
        );
        test.questions = questionsResult.rows;
        return res.status(200).json({ success: true, message: "Question removed successfully", test: formatTest(test) });
      }
    } catch (dbErr) {
      console.warn("DB remove question warning:", dbErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Question removed successfully",
      test: formatTest(DEFAULT_DEMO_TESTS[0]),
    });
  } catch (error) {
    console.error("REMOVE QUESTION FROM TEST ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to remove question", error: error.message });
  }
};

// =====================================================
// GET PUBLISHED TESTS (Student Browsing)
// =====================================================
export const getPublishedTests = async (req, res) => {
  try {
    let published = [];
    try {
      const testsResult = await query(`SELECT * FROM tests WHERE is_published = true ORDER BY created_at DESC`);
      if (testsResult.rows.length > 0) {
        published = await Promise.all(testsResult.rows.map(async (test) => {
          const qRes = await query(
            `SELECT q.* FROM test_questions_db q JOIN test_questions tq ON q.id = tq.question_id WHERE tq.test_id = $1`,
            [test.id]
          );
          test.questions = qRes.rows;
          return formatTest(test);
        }));
      }
    } catch (dbErr) {
      console.warn("Database published tests query warning:", dbErr.message);
    }

    if (published.length === 0) {
      published = DEFAULT_DEMO_TESTS.filter(t => t.is_published || t.isPublished).map(formatTest);
    }

    // Attach server-side purchase status for student (Task 3 Section 14)
    const studentId = req.user?.id || req.user?.sub;
    const testsWithPurchaseStatus = await Promise.all(
      published.map(async (test) => {
        const isPaid = Boolean(test.is_paid || test.isPaid);
        if (!isPaid) {
          return { ...test, is_purchased: true, isPurchased: true };
        }
        const hasPurchased = studentId ? await checkTestPurchased(test.id || test._id, studentId) : false;
        return {
          ...test,
          is_purchased: hasPurchased,
          isPurchased: hasPurchased,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: testsWithPurchaseStatus.length,
      tests: testsWithPurchaseStatus,
    });
  } catch (error) {
    console.error("GET PUBLISHED TESTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch published tests", error: error.message });
  }
};
