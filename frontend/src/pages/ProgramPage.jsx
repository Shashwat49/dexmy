import { Link } from "react-router-dom";
import SEO from "../components/SEO";

const programs = {
  sat: {
    name: "SAT Tutoring",
    path: "/sat-tutoring",
    title: "SAT Tutoring Online | 1-on-1 SAT Prep | Dexmy",
    description:
      "Get personalized SAT tutoring online with 1-on-1 live instruction, targeted practice, test strategy, and preparation built around your learning goals.",
    eyebrow: "SAT · 1-on-1 Online Tutoring",
    hero:
      "Prepare for the Digital SAT with focused 1-on-1 tutoring designed around your strengths, weak areas, and preparation goals.",
    overview:
      "SAT preparation requires more than knowing the content. Students also need to become comfortable with SAT-style questions, manage their time, review mistakes, and develop a consistent approach to unfamiliar problems. Dexmy tutoring gives students dedicated teacher attention so lessons can focus on the areas that need the most work.",
    whoFor: [
      "Students preparing for the Digital SAT",
      "Students who want structured support across Math, Reading, and Writing",
      "Students who need help identifying and working on weaker areas",
      "Students looking for guided practice and test-taking strategy",
    ],
    topics: [
      "Algebra",
      "Advanced Math",
      "Problem Solving & Data Analysis",
      "Geometry & Trigonometry",
      "Information and Ideas",
      "Craft and Structure",
      "Expression of Ideas",
      "Standard English Conventions",
    ],
    whyDexmy: [
      "1-on-1 live tutoring with dedicated teacher attention",
      "Lessons adjusted to the student's current understanding",
      "Targeted practice for challenging areas",
      "Real-time doubt solving and guided problem solving",
      "Flexible learning around school and other commitments",
    ],
    benefits: [
      "Spend more lesson time on the concepts that need attention",
      "Ask questions and receive explanations in real time",
      "Work through SAT-style questions with guidance",
      "Review mistakes and understand why an answer went wrong",
      "Build a more consistent approach to time management and test strategy",
    ],
    strategy: [
      "Understand the student's current preparation level and goals",
      "Identify difficult concepts and recurring question-solving mistakes",
      "Strengthen the relevant Math and Reading & Writing skills",
      "Practice SAT-style questions with guided feedback",
      "Use error analysis to improve future problem-solving",
      "Build confidence with timed and full-length practice as appropriate",
    ],
    faqs: [
      {
        q: "What does SAT tutoring at Dexmy focus on?",
        a: "SAT tutoring can focus on the Digital SAT's Math and Reading & Writing areas, including concept understanding, SAT-style practice, error analysis, time management, and test strategy.",
      },
      {
        q: "Is SAT tutoring suitable for students at different preparation levels?",
        a: "Yes. The learning plan can be adjusted around the student's current understanding, difficult topics, and preparation goals.",
      },
      {
        q: "Can tutoring help with SAT test strategy?",
        a: "Yes. Sessions can include question-solving approaches, time management, review of mistakes, and practice with SAT-style questions.",
      },
      {
        q: "How does 1-on-1 SAT tutoring work?",
        a: "Students learn live with a tutor, ask questions during the lesson, work through problems, and receive guidance based on their individual needs.",
      },
      {
        q: "Can I focus on specific SAT topics?",
        a: "Yes. Lessons can be targeted toward the concepts and question types that require additional practice.",
      },
      {
        q: "Does Dexmy guarantee a particular SAT score?",
        a: "No. Dexmy does not make score guarantees. Preparation is focused on building understanding, practicing effectively, and improving test readiness.",
      },
    ],
  },

  psat: {
    name: "PSAT Tutoring",
    path: "/psat-tutoring",
    title: "PSAT Tutoring Online | 1-on-1 PSAT Prep | Dexmy",
    description:
      "Personalized PSAT tutoring online with 1-on-1 instruction for Math, Reading and Writing, core skills, practice, and test preparation.",
    eyebrow: "PSAT · 1-on-1 Online Tutoring",
    hero:
      "Build stronger Math, Reading, and Writing skills with personalized PSAT tutoring designed around your current level and preparation goals.",
    overview:
      "The PSAT/NMSQT gives students an opportunity to develop skills that are also relevant to later SAT preparation. Dexmy tutoring focuses specifically on the PSAT while helping students build the underlying academic and question-solving skills they can continue developing.",
    whoFor: [
      "Middle and high school students preparing for the PSAT/NMSQT",
      "Students who want stronger core Math skills",
      "Students working on Reading and Writing skills",
      "Students who want guided practice and structured preparation",
    ],
    topics: [
      "PSAT Math",
      "PSAT Reading",
      "PSAT Writing",
      "Core academic skills",
      "Question-solving techniques",
      "Time management",
      "Practice and error analysis",
    ],
    whyDexmy: [
      "Personalized 1-on-1 instruction",
      "Support focused on the student's current skill level",
      "Guided practice with feedback",
      "Real-time doubt solving",
      "A structured preparation approach that can develop skills for future SAT preparation",
    ],
    benefits: [
      "Get individual attention instead of following a one-size-fits-all lesson",
      "Spend more time on difficult concepts",
      "Practice questions with teacher guidance",
      "Understand mistakes through review and feedback",
      "Develop stronger academic and test-taking habits",
    ],
    strategy: [
      "Understand the student's PSAT goals and current preparation",
      "Identify gaps in core Math, Reading, and Writing skills",
      "Strengthen concepts through focused instruction",
      "Practice PSAT-style questions",
      "Review errors and improve question-solving approaches",
      "Develop time-management and test-preparation habits",
    ],
    faqs: [
      {
        q: "What is the difference between PSAT and SAT tutoring?",
        a: "PSAT tutoring focuses on PSAT/NMSQT preparation and its specific requirements. The skills developed can also support a student's longer-term SAT preparation.",
      },
      {
        q: "Who can benefit from PSAT tutoring?",
        a: "Middle and high school students preparing for the PSAT/NMSQT can use tutoring for concept support, practice, strategy, and structured preparation.",
      },
      {
        q: "Does PSAT tutoring include Math and Reading & Writing?",
        a: "Yes. Preparation can cover the relevant Math, Reading, and Writing skills and question-solving approaches.",
      },
      {
        q: "Can lessons focus on weak areas?",
        a: "Yes. Individual tutoring allows lessons and practice to be adjusted toward areas where the student needs more support.",
      },
      {
        q: "Can PSAT preparation help with future SAT preparation?",
        a: "The PSAT and SAT share important underlying skills, so building strong academic and question-solving skills through PSAT preparation can support future SAT work.",
      },
      {
        q: "Does Dexmy guarantee a PSAT score?",
        a: "No. Dexmy focuses on personalized learning, practice, and preparation rather than guaranteeing a particular score.",
      },
    ],
  },

  ap: {
    name: "AP Tutoring",
    path: "/ap-tutoring",
    title: "AP Tutoring Online | 1-on-1 AP Exam Preparation | Dexmy",
    description:
      "Get personalized 1-on-1 AP tutoring online for course concepts, challenging questions, problem solving, practice, and exam preparation.",
    eyebrow: "AP · 1-on-1 Online Tutoring",
    hero:
      "Get focused AP tutoring built around your specific course, difficult concepts, practice needs, and exam preparation goals.",
    overview:
      "AP is not a single subject. Preparation depends on the particular AP course a student is taking and the concepts and question types required for that course. Dexmy's 1-on-1 approach gives students space to work through challenging topics, ask questions, practice AP-style problems, and prepare for their examination.",
    whoFor: [
      "High-school students taking an AP course",
      "Students who need help understanding difficult course concepts",
      "Students looking for guided AP-style question practice",
      "Students preparing for an AP examination",
    ],
    topics: [
      "Course-specific concepts",
      "Problem solving",
      "AP-style questions",
      "Difficult or unfamiliar topics",
      "Exam strategy",
      "Time management",
      "Practice and review",
    ],
    whyDexmy: [
      "Course-focused 1-on-1 support",
      "Individual attention for difficult concepts",
      "Guided practice and feedback",
      "Flexible lessons around the student's needs",
      "Preparation that can adapt as the examination approaches",
    ],
    benefits: [
      "Work through difficult AP concepts step by step",
      "Ask questions without waiting for a whole class",
      "Practice AP-style questions with guidance",
      "Review errors and improve problem-solving approaches",
      "Use lesson time for the topics that need the most attention",
    ],
    strategy: [
      "Identify the student's AP course, goals, and current understanding",
      "Find concepts or question types causing difficulty",
      "Strengthen the underlying concepts",
      "Practice AP-style questions",
      "Review mistakes and refine problem-solving methods",
      "Use timed practice and examination-focused review when appropriate",
    ],
    faqs: [
      {
        q: "Does Dexmy provide tutoring for every AP subject?",
        a: "AP tutoring is course-specific. Subject availability should be confirmed with Dexmy before booking if you have a particular AP course in mind.",
      },
      {
        q: "Can AP tutoring help with difficult concepts?",
        a: "Yes. Individual lessons can spend more time unpacking concepts that students find challenging.",
      },
      {
        q: "Does AP tutoring include exam preparation?",
        a: "Yes. Preparation can include AP-style questions, practice, strategy, time management, and review of difficult areas.",
      },
      {
        q: "Can I get help with a specific AP course?",
        a: "Yes. AP preparation should be tailored to the particular course rather than treated as a single general subject.",
      },
      {
        q: "How is 1-on-1 AP tutoring different from classroom learning?",
        a: "The lesson can be paced around the individual student, allowing more time for questions, difficult concepts, and targeted practice.",
      },
      {
        q: "Does Dexmy guarantee AP examination results?",
        a: "No. Dexmy does not guarantee a particular examination result. The focus is on understanding, practice, and preparation.",
      },
    ],
  },

  tmua: {
    name: "TMUA Tutoring",
    path: "/tmua-tutoring",
    title: "TMUA Tutoring Online | 1-on-1 TMUA Preparation | Dexmy",
    description:
      "Prepare for the TMUA with focused 1-on-1 tutoring in mathematical reasoning, problem solving, logical thinking, practice, and exam technique.",
    eyebrow: "TMUA · Mathematical Reasoning",
    hero:
      "Develop the mathematical reasoning and problem-solving skills needed to approach challenging TMUA questions with greater structure and confidence.",
    overview:
      "TMUA preparation is centered on mathematical thinking and problem solving. Students need to approach unfamiliar problems carefully rather than relying only on memorized formulas. Dexmy tutoring provides individual guidance to help students understand the reasoning behind different approaches and learn from mistakes.",
    whoFor: [
      "Students preparing for the Test of Mathematics for University Admission",
      "Students working on advanced mathematical reasoning",
      "Students who want more practice with non-routine problems",
      "Students preparing around a university application timeline",
    ],
    topics: [
      "Algebra",
      "Geometry",
      "Functions",
      "Number concepts",
      "Probability and statistical reasoning where relevant",
      "Interpreting mathematical information",
      "Non-routine problem solving",
      "Multiple-choice question techniques",
    ],
    whyDexmy: [
      "1-on-1 mathematical reasoning support",
      "Guided work through challenging problems",
      "Focus on approaches rather than formula memorization",
      "Error analysis and discussion of common mistakes",
      "Preparation that can be structured around the student's timeline and goals",
    ],
    benefits: [
      "Work through unfamiliar problems with individual guidance",
      "Understand why a particular approach works",
      "Identify recurring mistakes in mathematical reasoning",
      "Practice solving questions under time constraints",
      "Develop a more disciplined problem-solving process",
    ],
    strategy: [
      "Understand the student's target, timeline, and current preparation",
      "Review the mathematical concepts relevant to the preparation",
      "Practice unfamiliar and non-routine problems",
      "Develop structured approaches to multiple-choice questions",
      "Analyse mistakes rather than simply checking answers",
      "Use timed practice and mock-style preparation to build exam readiness",
    ],
    faqs: [
      {
        q: "What does TMUA tutoring focus on?",
        a: "TMUA tutoring focuses on mathematical reasoning, problem solving, logical thinking, relevant mathematical concepts, question-solving approaches, and exam technique.",
      },
      {
        q: "Is TMUA preparation about memorizing formulas?",
        a: "No. The preparation approach emphasizes understanding mathematical ideas and developing a structured way to approach unfamiliar problems.",
      },
      {
        q: "Can TMUA tutoring include timed practice?",
        a: "Yes. Timed practice can be incorporated to help students develop their approach to questions under examination conditions.",
      },
      {
        q: "Can tutoring focus on my weak mathematical areas?",
        a: "Yes. The preparation can be adjusted around concepts and problem types that require additional attention.",
      },
      {
        q: "Is TMUA tutoring suitable for university applicants?",
        a: "Yes. Students preparing for the TMUA as part of their university application process can structure preparation around their target timeline.",
      },
      {
        q: "Does Dexmy guarantee a TMUA result?",
        a: "No. Dexmy does not guarantee a particular TMUA result. Preparation focuses on developing mathematical reasoning and exam readiness.",
      },
    ],
  },

  igcse: {
    name: "IGCSE Tutoring",
    path: "/igcse-tutoring",
    title: "IGCSE Tutoring Online | 1-on-1 IGCSE Classes | Dexmy",
    description:
      "Personalized 1-on-1 IGCSE tutoring online for syllabus-based learning, difficult concepts, school support, revision, past papers, and exam preparation.",
    eyebrow: "IGCSE · 1-on-1 Online Tutoring",
    hero:
      "Strengthen your IGCSE understanding with personalized tutoring aligned with your subject, syllabus, current level, and examination goals.",
    overview:
      "IGCSE preparation is subject-oriented and depends on the student's syllabus and level. Dexmy tutoring can support concept building, schoolwork, difficult topics, revision, past-paper practice, and examination technique while keeping lessons focused on the student's needs.",
    whoFor: [
      "Students preparing for IGCSE subjects",
      "Students who need help understanding difficult syllabus topics",
      "Students looking for support with schoolwork and homework",
      "Students preparing for revision and examinations",
    ],
    topics: [
      "Subject-specific syllabus concepts",
      "Concept building",
      "Guided problem solving",
      "Past-paper practice",
      "Revision",
      "Exam technique",
      "Coursework or assessment support where applicable",
    ],
    whyDexmy: [
      "Personalized 1-on-1 subject support",
      "Lessons adapted to the student's level and syllabus",
      "Focused concept clarification",
      "Guided practice and feedback",
      "Support for both learning and examination preparation",
    ],
    benefits: [
      "Get explanations at a pace suited to your understanding",
      "Focus on difficult syllabus areas",
      "Work through practice questions with guidance",
      "Review past-paper questions and mistakes",
      "Balance school support with structured examination preparation",
    ],
    strategy: [
      "Identify the student's subject, syllabus, level, and goals",
      "Review current understanding and difficult topics",
      "Strengthen concepts through focused lessons",
      "Practice relevant question types",
      "Use past papers and error review for examination preparation",
      "Refine revision and exam technique as needed",
    ],
    faqs: [
      {
        q: "Does IGCSE tutoring cover every subject?",
        a: "IGCSE tutoring is subject-specific, and availability can vary. Confirm the particular subject with Dexmy before booking.",
      },
      {
        q: "Can IGCSE tutoring help with schoolwork?",
        a: "Yes. Tutoring can support difficult concepts, homework, schoolwork, and questions related to the student's syllabus.",
      },
      {
        q: "Can lessons use past papers?",
        a: "Yes. Past-paper practice can be used for revision and to develop familiarity with examination-style questions.",
      },
      {
        q: "Can I get help with a difficult topic?",
        a: "Yes. Individual lessons can focus specifically on concepts or question types that need more attention.",
      },
      {
        q: "Does IGCSE tutoring include exam technique?",
        a: "Yes. Preparation can include revision, question practice, time management, and examination technique.",
      },
      {
        q: "Will the tutoring follow my exact syllabus?",
        a: "Lessons should be tailored to the student's subject and syllabus. Share your syllabus or examination details when discussing your tutoring needs.",
      },
    ],
  },

  "ib-myp": {
    name: "IB MYP Tutoring",
    path: "/ib-myp-tutoring",
    title: "IB MYP Tutoring Online | 1-on-1 IB MYP Support | Dexmy",
    description:
      "Personalized 1-on-1 IB MYP tutoring online for conceptual learning, application, problem solving, assignments, projects, and assessment preparation.",
    eyebrow: "IB MYP · Conceptual Learning",
    hero:
      "Build deeper understanding in IB MYP through personalized tutoring focused on concepts, application, problem solving, and independent learning.",
    overview:
      "IB MYP learning is not simply traditional examination preparation. Students are expected to understand ideas, apply them in different contexts, solve problems, and communicate their thinking. Dexmy tutoring provides individual support for concepts, assignments, projects, and assessment preparation.",
    whoFor: [
      "Students studying within the IB Middle Years Programme",
      "Students who need additional support with difficult concepts",
      "Students working on assignments or projects",
      "Students preparing for assessments and building independent learning skills",
    ],
    topics: [
      "Conceptual understanding",
      "Application of knowledge",
      "Problem solving",
      "Inquiry-based learning",
      "Assignments and projects",
      "Assessment preparation",
      "Criterion-based assessment support",
      "Independent learning",
      "Real-world connections",
    ],
    whyDexmy: [
      "Individual teacher attention",
      "Focus on understanding and application",
      "Support for assignments and projects",
      "Guided problem solving",
      "Lessons adapted to the student's pace and learning needs",
    ],
    benefits: [
      "Explore difficult concepts through individual discussion",
      "Connect ideas with practical or real-world contexts",
      "Get guidance while working through problems",
      "Build stronger independent-learning habits",
      "Prepare for assessments with a clearer understanding of expectations",
    ],
    strategy: [
      "Understand the student's MYP subject and learning goals",
      "Identify concepts that need clarification",
      "Build understanding through questions, examples, and application",
      "Work through assignments or projects with appropriate guidance",
      "Review assessment requirements and areas for improvement",
      "Encourage independent thinking and problem solving",
    ],
    faqs: [
      {
        q: "Is IB MYP tutoring only for exam preparation?",
        a: "No. IB MYP tutoring can support conceptual learning, application, problem solving, assignments, projects, and assessment preparation.",
      },
      {
        q: "Can tutoring help with MYP assignments?",
        a: "Yes. Students can receive guidance while working through assignments and projects, with the focus on understanding and independent learning.",
      },
      {
        q: "What makes IB MYP tutoring different?",
        a: "The approach emphasizes conceptual understanding, application, inquiry, problem solving, and communication rather than only traditional exam practice.",
      },
      {
        q: "Can lessons focus on a particular subject?",
        a: "Yes. IB MYP support can be tailored to the student's subject and current learning needs.",
      },
      {
        q: "Can tutoring support MYP assessments?",
        a: "Yes. Sessions can include preparation for assessments and help students understand and apply the relevant concepts.",
      },
      {
        q: "Does Dexmy guarantee IB MYP results?",
        a: "No. Dexmy does not guarantee particular academic results. Tutoring focuses on understanding, practice, and learning support.",
      },
    ],
  },

  gcse: {
    name: "GCSE Tutoring",
    path: "/gcse-tutoring",
    title: "GCSE Tutoring Online | 1-on-1 GCSE Classes | Dexmy",
    description:
      "1-on-1 GCSE tutoring online for personalized concept support, syllabus-based learning, revision, past papers, exam technique, and preparation.",
    eyebrow: "GCSE · 1-on-1 Online Tutoring",
    hero:
      "Prepare for GCSEs with personalized tutoring that combines concept clarity, syllabus-focused practice, revision, and examination preparation.",
    overview:
      "GCSE preparation depends on the subject and examination board. Dexmy tutoring gives students individual support for difficult concepts, schoolwork, revision, past-paper practice, time management, and examination technique.",
    whoFor: [
      "Students preparing for GCSE subjects",
      "Students who need support with difficult topics",
      "Students looking for school and homework support",
      "Students preparing for revision and examinations",
    ],
    topics: [
      "Syllabus-based concepts",
      "Conceptual understanding",
      "Problem solving",
      "Revision",
      "Past-paper practice",
      "Exam technique",
      "Time management",
      "Weak-topic preparation",
    ],
    whyDexmy: [
      "Personalized 1-on-1 GCSE tutoring",
      "Individual attention for difficult topics",
      "Guided practice and feedback",
      "Support that can adapt to the student's current level",
      "Flexible preparation around school and examination goals",
    ],
    benefits: [
      "Spend more time on difficult GCSE topics",
      "Ask questions and receive immediate explanations",
      "Practice examination-style questions with guidance",
      "Review mistakes and improve techniques",
      "Build a structured revision approach",
    ],
    strategy: [
      "Identify the student's subject, examination board, level, and goals",
      "Assess difficult topics and current understanding",
      "Strengthen concepts through focused instruction",
      "Practice relevant examination-style questions",
      "Review past-paper mistakes",
      "Build revision, time-management, and exam techniques",
    ],
    faqs: [
      {
        q: "Does GCSE tutoring follow the student's examination board?",
        a: "GCSE content varies by examination board, so tutoring should be aligned with the student's relevant syllabus and examination requirements.",
      },
      {
        q: "Can GCSE tutoring help with schoolwork?",
        a: "Yes. Sessions can support schoolwork, homework, difficult concepts, and examination preparation.",
      },
      {
        q: "Can I practice past papers with a tutor?",
        a: "Yes. Past-paper questions can be used for practice, revision, error analysis, and examination technique.",
      },
      {
        q: "Can tutoring focus on weak topics?",
        a: "Yes. The 1-on-1 format allows more lesson time to be directed toward topics that need additional practice.",
      },
      {
        q: "Does GCSE tutoring include exam strategy?",
        a: "Yes. Preparation can include question-solving, time management, revision, and examination technique.",
      },
      {
        q: "Does Dexmy guarantee GCSE grades?",
        a: "No. Dexmy does not guarantee particular grades. The focus is on understanding, practice, and preparation.",
      },
    ],
  },

  cbse: {
    name: "CBSE Tutoring",
    path: "/cbse-tutoring",
    title: "CBSE Tutoring Online | 1-on-1 CBSE Classes | Dexmy",
    description:
      "Personalized 1-on-1 CBSE tutoring online for concept building, school support, doubt solving, practice, revision, and exam preparation.",
    eyebrow: "CBSE · 1-on-1 Online Tutoring",
    hero:
      "Strengthen your CBSE learning with personalized tutoring for concepts, schoolwork, doubt solving, practice, revision, and examination preparation.",
    overview:
      "CBSE students may need support for different reasons: catching up on difficult concepts, keeping up with schoolwork, solving doubts, or preparing in a structured way for examinations. Dexmy's 1-on-1 format lets students work directly with a tutor around their current needs.",
    whoFor: [
      "Students following the CBSE curriculum",
      "Students who need help with difficult concepts",
      "Students looking for schoolwork and homework support",
      "Students preparing for examinations and revision",
    ],
    topics: [
      "Curriculum-based concepts",
      "NCERT-based learning where applicable",
      "Problem solving",
      "Doubt solving",
      "Revision",
      "Practice questions",
      "Previous-year question practice",
      "Exam preparation",
    ],
    whyDexmy: [
      "Personalized 1-on-1 curriculum support",
      "Dedicated teacher attention",
      "Real-time doubt solving",
      "Targeted practice around difficult areas",
      "Flexible learning based on the student's pace and goals",
    ],
    benefits: [
      "Get individual explanations for difficult concepts",
      "Resolve doubts during live lessons",
      "Work through practice questions step by step",
      "Balance catching up with structured examination preparation",
      "Spend more time on areas that require additional practice",
    ],
    strategy: [
      "Understand the student's class, curriculum, and goals",
      "Identify concepts that require additional support",
      "Build understanding through focused instruction",
      "Practice relevant questions and review mistakes",
      "Use revision and previous-year question practice where appropriate",
      "Build an organized examination-preparation routine",
    ],
    faqs: [
      {
        q: "Who is CBSE tutoring for?",
        a: "CBSE tutoring is for students following the CBSE curriculum who want additional support with concepts, schoolwork, doubts, practice, revision, or examination preparation.",
      },
      {
        q: "Can CBSE tutoring help with school homework?",
        a: "Yes. Sessions can be used to clarify concepts and support schoolwork and homework.",
      },
      {
        q: "Can tutoring be used for catching up?",
        a: "Yes. Individual lessons can spend more time on concepts the student has not yet understood before moving ahead.",
      },
      {
        q: "Can I practice previous-year questions?",
        a: "Previous-year question practice can be incorporated into preparation where relevant to the student's class and examination goals.",
      },
      {
        q: "Does CBSE tutoring include doubt solving?",
        a: "Yes. Live 1-on-1 lessons provide an opportunity to ask questions and work through doubts with a tutor.",
      },
      {
        q: "Does Dexmy guarantee CBSE marks?",
        a: "No. Dexmy does not guarantee particular marks or examination results.",
      },
    ],
  },

  icse: {
    name: "ICSE Tutoring",
    path: "/icse-tutoring",
    title: "ICSE Tutoring Online | 1-on-1 ICSE Classes | Dexmy",
    description:
      "Personalized 1-on-1 ICSE tutoring online for concept clarity, school support, doubt solving, revision, practice, and examination preparation.",
    eyebrow: "ICSE · 1-on-1 Online Tutoring",
    hero:
      "Build stronger ICSE fundamentals with personalized tutoring for concept clarity, schoolwork, practice, revision, and examination preparation.",
    overview:
      "ICSE students can benefit from focused support that connects classroom learning with deeper concept understanding and examination preparation. Dexmy tutoring provides individual teacher attention for difficult topics, doubts, revision, practice, and time-management skills.",
    whoFor: [
      "Students following the ICSE curriculum",
      "Students who need additional support with difficult concepts",
      "Students looking for schoolwork and doubt-solving help",
      "Students preparing for revision and examinations",
    ],
    topics: [
      "Curriculum-based concepts",
      "Concept clarification",
      "Problem solving",
      "Revision",
      "Previous-year paper practice",
      "Time management",
      "Exam preparation",
      "Subject-specific support",
    ],
    whyDexmy: [
      "Personalized 1-on-1 ICSE tutoring",
      "Dedicated teacher attention",
      "Focused concept clarification",
      "Guided practice and feedback",
      "Learning plans adapted to individual needs",
    ],
    benefits: [
      "Get focused explanations for difficult concepts",
      "Ask questions and resolve doubts live",
      "Practice questions with individual guidance",
      "Review important topics before examinations",
      "Develop a more structured approach to revision and time management",
    ],
    strategy: [
      "Understand the student's class, curriculum, and goals",
      "Identify difficult topics and learning gaps",
      "Strengthen concepts through focused instruction",
      "Practice relevant questions and previous-year papers",
      "Analyse mistakes and revisit weak areas",
      "Build revision and examination strategies around the student's timeline",
    ],
    faqs: [
      {
        q: "Who is ICSE tutoring for?",
        a: "ICSE tutoring is designed for students following the ICSE curriculum who need support with concepts, schoolwork, doubts, practice, revision, or examination preparation.",
      },
      {
        q: "Can ICSE tutoring help with difficult topics?",
        a: "Yes. Lessons can focus on specific concepts or question types where the student needs additional explanation and practice.",
      },
      {
        q: "Can tutoring help with ICSE schoolwork?",
        a: "Yes. Students can use individual lessons for concept clarification and support with relevant schoolwork.",
      },
      {
        q: "Can previous-year papers be part of preparation?",
        a: "Yes. Previous-year papers can be used for practice, revision, and understanding examination-style questions where appropriate.",
      },
      {
        q: "Does ICSE tutoring include time management?",
        a: "Time-management techniques can be included as part of examination preparation and practice.",
      },
      {
        q: "Does Dexmy guarantee ICSE marks or grades?",
        a: "No. Dexmy does not guarantee particular marks or grades. The focus is on learning, practice, and examination readiness.",
      },
    ],
  },
};

const allPrograms = Object.values(programs);

const commonLinks = [
  { label: "SAT Tutoring", path: "/sat-tutoring" },
  { label: "PSAT Tutoring", path: "/psat-tutoring" },
  { label: "AP Tutoring", path: "/ap-tutoring" },
  { label: "TMUA Tutoring", path: "/tmua-tutoring" },
  { label: "IGCSE Tutoring", path: "/igcse-tutoring" },
  { label: "IB MYP Tutoring", path: "/ib-myp-tutoring" },
  { label: "GCSE Tutoring", path: "/gcse-tutoring" },
  { label: "CBSE Tutoring", path: "/cbse-tutoring" },
  { label: "ICSE Tutoring", path: "/icse-tutoring" },
];

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="max-w-3xl">
      {eyebrow && (
        <p className="mb-3 text-sm font-semibold uppercase tracking-[2px] text-brand-gold">
          {eyebrow}
        </p>
      )}

      <h2 className="font-display text-3xl tracking-tight md:text-5xl">
        {title}
      </h2>

      {description && (
        <p className="mt-5 text-base leading-relaxed text-chalk-muted md:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}

function Card({ children }) {
  return (
    <article className="rounded-2xl border border-chalk-faint bg-panel-2 p-6 md:p-7">
      {children}
    </article>
  );
}

export default function ProgramPage({ slug }) {
  const program = programs[slug];

  if (!program) return null;

  const relatedPrograms = allPrograms
    .filter((item) => item.path !== program.path)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-void text-chalk">
      <SEO
        title={program.title}
        description={program.description}
        path={program.path}
      />

      {/* Header */}
      <header className="border-b border-chalk-faint bg-void/95 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            to="/"
            className="font-display text-2xl tracking-tight"
            aria-label="Dexmy home"
          >
            Dexmy
          </Link>

          <div className="flex items-center gap-5">
            <Link
              to="/packages"
              className="hidden text-sm text-chalk-muted transition-colors hover:text-chalk sm:block"
            >
              Packages
            </Link>

            <Link
              to="/login"
              className="text-sm font-semibold text-brand-gold transition-colors hover:text-chalk"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-chalk-faint px-6 py-20 md:px-12 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-4xl">
              <p className="mb-5 text-sm font-semibold uppercase tracking-[2px] text-brand-gold">
                {program.eyebrow}
              </p>

              <h1 className="font-display text-5xl leading-[1.05] tracking-tight md:text-7xl">
                {program.name}
              </h1>

              <p className="mt-7 max-w-3xl text-lg leading-relaxed text-chalk-muted md:text-xl">
                {program.hero}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-lg bg-brand-red px-7 py-3.5 font-semibold text-white transition-colors hover:bg-brand-red-dark"
                >
                  Book a Free Trial
                </Link>

                <Link
                  to="/packages"
                  className="inline-flex items-center justify-center rounded-lg border border-chalk-faint px-7 py-3.5 font-semibold text-chalk transition-colors hover:border-chalk-muted"
                >
                  Explore Packages
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Overview */}
        <section className="px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Overview"
              title={`A focused approach to ${program.name.replace(
                " Tutoring",
                ""
              )} preparation`}
              description={program.overview}
            />
          </div>
        </section>

        {/* Who is it for */}
        <section className="border-y border-chalk-faint bg-panel px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Who it's for"
              title={`Who can benefit from ${program.name}?`}
            />

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {program.whoFor.map((item) => (
                <Card key={item}>
                  <div className="flex gap-4">
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-gold text-sm text-brand-gold">
                      ✓
                    </span>
                    <p className="leading-relaxed text-chalk-muted">{item}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Topics */}
        <section className="px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Topics & skills"
              title="Learn what you need, when you need it."
              description={`Your lessons can focus on the concepts, skills, and question types that matter most for your ${program.name.replace(
                " Tutoring",
                ""
              )} preparation.`}
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {program.topics.map((topic) => (
                <Card key={topic}>
                  <h3 className="font-semibold leading-snug">{topic}</h3>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Why Dexmy */}
        <section className="border-y border-chalk-faint bg-panel px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Why Dexmy"
              title="Learning built around the student."
              description="Dexmy's 1-on-1 approach gives students dedicated teacher attention and space to work on the areas that need the most focus."
            />

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {program.whyDexmy.map((item, index) => (
                <Card key={item}>
                  <p className="mb-4 text-sm font-semibold text-brand-gold">
                    0{index + 1}
                  </p>
                  <h3 className="leading-relaxed">{item}</h3>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="1-on-1 benefits"
              title="More attention. More focused practice."
              description="Individual tutoring makes it easier to ask questions, revisit difficult ideas, and spend lesson time where it is most useful."
            />

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {program.benefits.map((item) => (
                <Card key={item}>
                  <p className="leading-relaxed text-chalk-muted">{item}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Learning Process */}
        <section className="border-y border-chalk-faint bg-panel px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="How Dexmy works"
              title="A simple learning process."
            />

            <div className="mt-10 grid gap-5 md:grid-cols-5">
              {[
                {
                  number: "01",
                  title: "Book a trial",
                  text: "Start with a free trial to discuss your learning needs.",
                },
                {
                  number: "02",
                  title: "Understand goals",
                  text: "Identify goals, current understanding, and areas needing support.",
                },
                {
                  number: "03",
                  title: "Personalized instruction",
                  text: "Work through concepts and questions with individual teacher attention.",
                },
                {
                  number: "04",
                  title: "Practice & feedback",
                  text: "Practice relevant problems and review mistakes with guidance.",
                },
                {
                  number: "05",
                  title: "Continue your plan",
                  text: "Continue with a suitable learning plan based on your needs.",
                },
              ].map((step) => (
                <Card key={step.number}>
                  <p className="text-sm font-semibold text-brand-gold">
                    {step.number}
                  </p>
                  <h3 className="mt-4 font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-chalk-muted">
                    {step.text}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* What students get */}
        <section className="px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="What students get"
              title="Support that stays focused on their learning."
            />

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Live 1-on-1 teacher interaction",
                "Personalized instruction",
                "Guided practice",
                "Real-time doubt solving",
                "Targeted topic support",
                "Feedback on practice and mistakes",
              ].map((item) => (
                <Card key={item}>
                  <h3 className="font-semibold leading-relaxed">{item}</h3>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Preparation Strategy */}
        <section className="border-y border-chalk-faint bg-panel px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Preparation strategy"
              title={`A practical way to prepare for ${program.name.replace(
                " Tutoring",
                ""
              )}.`}
              description="The exact focus can change with your current level, timeline, and learning goals."
            />

            <div className="mt-10 space-y-4">
              {program.strategy.map((item, index) => (
                <div
                  key={item}
                  className="flex gap-5 rounded-2xl border border-chalk-faint bg-panel-2 p-5 md:p-6"
                >
                  <span className="shrink-0 text-sm font-semibold text-brand-gold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="leading-relaxed text-chalk-muted">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-4xl">
            <SectionHeading
              eyebrow="FAQ"
              title={`Frequently asked questions about ${program.name}`}
            />

            <div className="mt-10 space-y-3">
              {program.faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-2xl border border-chalk-faint bg-panel-2"
                >
                  <summary className="cursor-pointer list-none px-6 py-5 font-semibold marker:hidden">
                    <div className="flex items-center justify-between gap-5">
                      <span>{faq.q}</span>
                      <span className="text-xl text-brand-gold transition-transform group-open:rotate-45">
                        +
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-chalk-faint px-6 py-5">
                    <p className="leading-relaxed text-chalk-muted">
                      {faq.a}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Related Programs */}
        <section className="border-t border-chalk-faint px-6 py-16 md:px-12">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Explore more"
              title="Explore other Dexmy programs."
            />

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {relatedPrograms.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="rounded-2xl border border-chalk-faint bg-panel-2 p-6 transition-colors hover:border-brand-gold"
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="mt-2 block text-sm text-chalk-muted">
                    Explore program →
                  </span>
                </Link>
              ))}
            </div>

            <div className="mt-6">
              <Link
                to="/packages"
                className="text-sm font-semibold text-brand-gold hover:underline"
              >
                View all packages →
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 pb-20 md:px-12 md:pb-28">
          <div className="mx-auto max-w-6xl rounded-3xl border border-chalk-faint bg-panel p-8 md:p-14">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[2px] text-brand-gold">
                Start learning with Dexmy
              </p>

              <h2 className="mt-4 font-display text-4xl tracking-tight md:text-6xl">
                Get focused support for your {program.name.replace(" Tutoring", "")} goals.
              </h2>

              <p className="mt-5 text-lg leading-relaxed text-chalk-muted">
                Start with a free trial and explore a learning approach built
                around your needs.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-lg bg-brand-red px-7 py-3.5 font-semibold text-white transition-colors hover:bg-brand-red-dark"
                >
                  Book a Free Trial
                </Link>

                <Link
                  to="/packages"
                  className="inline-flex items-center justify-center rounded-lg border border-chalk-faint px-7 py-3.5 font-semibold transition-colors hover:border-chalk-muted"
                >
                  Explore Packages
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}