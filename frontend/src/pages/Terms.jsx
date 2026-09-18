import { Link } from "react-router-dom";
import SEO from "../components/SEO";

const sections = [
  {
    title: "1. Acceptance of These Terms",
    body: [
      "These Terms of Service (\"Terms\") govern your access to and use of Dexmy, including our website, tutoring services, learning platform, dashboards, classrooms, booking features, packages, communications, and related services (collectively, the \"Services\").",
      "By creating an account, booking a class, purchasing a package, or otherwise using the Services, you agree to these Terms and our Privacy Policy. If you do not agree, please do not use the Services.",
    ],
  },
  {
    title: "2. About Dexmy",
    body: [
      "Dexmy is an educational technology platform that connects learners and tutors and provides access to personalised academic tutoring, learning resources, classes, scheduling, and related educational services.",
      "Dexmy may update, modify, suspend, or discontinue any part of the Services from time to time where reasonably necessary for operation, security, improvement, or legal compliance.",
    ],
  },
  {
    title: "3. Eligibility and Accounts",
    body: [
      "You must provide accurate, current, and complete information when creating an account and keep your account information updated.",
      "If a learner is a minor, the account and use of paid Services must be authorised by a parent or legal guardian where required by applicable law. Parents or guardians are responsible for supervising a minor's use of the Services and for transactions made on the minor's behalf.",
      "You are responsible for maintaining the confidentiality of your login credentials and for activity conducted through your account. Notify Dexmy promptly if you believe your account has been compromised.",
      "You may not create an account using false information, impersonate another person, or create an account for someone else without appropriate authority.",
    ],
  },
  {
    title: "4. Tutoring and Educational Services",
    body: [
      "Tutoring is provided for educational and learning-support purposes. Dexmy and its tutors do not guarantee a particular examination score, grade, admission outcome, scholarship, university placement, or other academic result.",
      "Students are responsible for attending classes, completing assigned work, preparing for examinations, and making appropriate use of the educational material and tutoring provided.",
      "Tutor availability, schedules, class formats, course content, and instructors may change when reasonably necessary. Dexmy will make reasonable efforts to communicate material changes.",
    ],
  },
  {
    title: "5. Bookings, Classes, and Attendance",
    body: [
      "Bookings are subject to tutor availability and the applicable package or service terms. A booking is considered confirmed only when the platform indicates that it has been successfully confirmed.",
      "Students should join classes on time and use the correct account and classroom link. Late arrival or failure to attend may result in loss of the scheduled class where the applicable package or booking rules so provide.",
      "Dexmy may establish reasonable rules concerning cancellations, rescheduling, class duration, tutor replacement, and use of class credits. Any package-specific rules displayed at purchase also apply.",
    ],
  },
  {
    title: "6. Packages, Pricing, and Payments",
    body: [
      "Prices, package contents, class counts, currencies, and applicable taxes or charges are displayed during the relevant purchase flow and may be changed for future purchases.",
      "You authorise Dexmy and its payment service providers to process payments for purchases you make through the Services. You agree to provide valid payment information and to pay all applicable charges.",
      "Unless otherwise expressly stated by Dexmy or required by applicable law, purchased tutoring packages and package payments are final and non-refundable in any case whatsoever. This includes unused classes, partially used packages, changes in personal circumstances, dissatisfaction with academic results, or failure to attend classes. Nothing in this section excludes any refund or other remedy that cannot lawfully be excluded under applicable law.",
      "Promotional offers, discounts, credits, or special pricing may be subject to additional conditions and may not be combined unless expressly permitted.",
    ],
  },
  {
    title: "7. Cancellations and Rescheduling",
    body: [
      "Any cancellation or rescheduling of an individual class is subject to the cancellation and scheduling rules communicated by Dexmy for the applicable service or package.",
      "Where a class must be cancelled or rescheduled by Dexmy or a tutor, Dexmy may, at its discretion and subject to applicable package rules, arrange a replacement class, reschedule the class, restore an applicable class credit, or provide another reasonable remedy.",
    ],
  },
  {
    title: "8. Tutor Relationship and Conduct",
    body: [
      "Tutors are expected to provide professional, respectful, and educational services. Learners and parents/guardians are expected to treat tutors and Dexmy personnel respectfully.",
      "You must not harass, threaten, discriminate against, abuse, or otherwise behave inappropriately toward tutors, students, parents, staff, or other platform users.",
      "You must not attempt to circumvent Dexmy to arrange undisclosed paid tutoring relationships with tutors introduced through the platform where doing so is intended to avoid applicable Dexmy fees or platform rules.",
    ],
  },
  {
    title: "9. Acceptable Use",
    body: [
      "You may use the Services only for lawful educational and personal purposes and in accordance with these Terms.",
      "You must not: (a) use the Services for unlawful, fraudulent, or harmful activity; (b) interfere with or disrupt the platform; (c) introduce malicious code; (d) attempt unauthorised access; (e) scrape, copy, reverse engineer, or systematically extract platform data except where permitted by law; (f) share account credentials; (g) upload content that infringes another person's rights; or (h) use the Services to harass, exploit, or endanger another person.",
    ],
  },
  {
    title: "10. Intellectual Property",
    body: [
      "Dexmy and its licensors retain all rights in the platform, software, branding, logos, design, text, graphics, interfaces, and other materials made available by Dexmy, except for content owned by users or third parties.",
      "Subject to these Terms, Dexmy grants you a limited, non-exclusive, non-transferable, revocable right to access and use the Services for their intended educational purpose.",
      "You may not reproduce, redistribute, sell, publish, modify, commercially exploit, or create derivative works from Dexmy materials without prior written permission, except where permitted by applicable law.",
    ],
  },
  {
    title: "11. User and Student Content",
    body: [
      "You may submit information, questions, assignments, notes, messages, feedback, profile information, or other content through the Services (\"User Content\"). You retain ownership of your User Content, subject to the rights necessary for Dexmy to operate the Services.",
      "By submitting User Content, you grant Dexmy a limited licence to host, store, reproduce, process, and display that content as reasonably necessary to provide, secure, maintain, and improve the Services and as otherwise permitted by our Privacy Policy and applicable law.",
      "You are responsible for ensuring that your User Content is lawful and does not infringe the rights of others. Dexmy may remove or restrict content that violates these Terms or applicable law.",
    ],
  },
  {
    title: "12. Classrooms, Communications, and Recordings",
    body: [
      "The Services may include video, audio, chat, whiteboards, file sharing, messaging, or other classroom functionality. You agree to use these features only for legitimate educational purposes.",
      "If a class is recorded or otherwise captured, Dexmy will provide appropriate notice or obtain consent where required by applicable law. Recording or capturing a class yourself may be restricted by law or platform rules and must not be done without the required permission.",
    ],
  },
  {
    title: "13. Third-Party Services",
    body: [
      "The Services may integrate with third-party providers, including payment processors, communication tools, authentication providers, hosting providers, analytics services, or external links. Third-party services may have their own terms and privacy policies.",
      "Dexmy is not responsible for the independent acts, omissions, availability, or policies of third-party services, except to the extent responsibility cannot be excluded under applicable law.",
    ],
  },
  {
    title: "14. Privacy",
    body: [
      "Your use of personal information is described in the Dexmy Privacy Policy. By using the Services, you acknowledge that Dexmy may collect, use, store, and process information as described there and as permitted by applicable law.",
    ],
  },
  {
    title: "15. Disclaimers",
    body: [
      "To the maximum extent permitted by applicable law, the Services are provided on an \"as available\" and \"as is\" basis. Dexmy does not warrant that the Services will always be uninterrupted, error-free, secure, or available at every location or time.",
      "Educational information and tutoring are provided for learning support and are not a guarantee of academic performance or outcomes. You remain responsible for your own academic decisions and preparation.",
    ],
  },
  {
    title: "16. Limitation of Liability",
    body: [
      "To the maximum extent permitted by applicable law, Dexmy and its directors, employees, tutors, contractors, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, data, goodwill, or opportunities arising from use of or inability to use the Services.",
      "To the maximum extent permitted by applicable law, Dexmy's aggregate liability arising from the Services will be limited to the amount you paid to Dexmy for the specific Service giving rise to the claim during the applicable period, except where a different limitation is required by applicable law.",
    ],
  },
  {
    title: "17. Indemnification",
    body: [
      "To the extent permitted by applicable law, you agree to indemnify and hold harmless Dexmy and its personnel from claims, losses, liabilities, damages, costs, and reasonable expenses arising from your unlawful use of the Services, violation of these Terms, infringement of another person's rights, or User Content that you submit.",
    ],
  },
  {
    title: "18. Suspension and Termination",
    body: [
      "Dexmy may suspend, restrict, or terminate an account or access to the Services if we reasonably believe that you have violated these Terms, created a security or legal risk, engaged in fraud or abuse, or otherwise misused the Services.",
      "You may stop using the Services at any time. Account closure does not automatically create a right to a refund of a purchased package, subject to the refund provisions above and applicable law.",
      "Provisions that by their nature should survive termination, including intellectual property, disclaimers, limitations of liability, indemnification, dispute provisions, and payment obligations, will survive termination.",
    ],
  },
  {
    title: "19. Changes to These Terms",
    body: [
      "Dexmy may update these Terms from time to time. The updated version will be posted on this page with a revised effective date. Where required by law, Dexmy will provide additional notice of material changes.",
      "Your continued use of the Services after the effective date of updated Terms constitutes acceptance of the updated Terms to the extent permitted by applicable law.",
    ],
  },
  {
    title: "20. Governing Law and Disputes",
    body: [
      "These Terms are intended to be governed by the laws applicable to Dexmy's operations in India, subject to any mandatory consumer-protection or other laws that apply to you.",
      "Before initiating formal proceedings, you agree to give Dexmy a reasonable opportunity to resolve a dispute by contacting us. Nothing in these Terms prevents a user from exercising rights or remedies that cannot lawfully be waived.",
    ],
  },
  {
    title: "21. General Provisions",
    body: [
      "If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will continue in effect to the extent permitted by law. Failure by Dexmy to enforce a provision is not a waiver of its right to do so later.",
      "These Terms, together with the Privacy Policy and any additional terms expressly applicable to a particular Service or purchase, constitute the agreement governing your use of the Services.",
    ],
  },
  {
    title: "22. Contact Us",
    body: [
      "For questions, complaints, account issues, or concerns regarding these Terms, contact Dexmy at dexmyedu@gmail.com or through the contact options available on the website.",
    ],
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-void text-chalk">
      <SEO
        title="Terms of Service | Dexmy"
        description="Terms of Service governing use of Dexmy tutoring and educational services."
        path="/terms"
      />

      <header className="border-b border-chalk-faint">
        <div className="mx-auto max-w-6xl px-6 md:px-12 py-5 flex items-center justify-between gap-4">
          <Link to="/" className="font-display text-2xl text-brand-red -skew-x-6">
            Dexmy
          </Link>
          <Link to="/" className="text-sm text-chalk-muted hover:text-chalk transition-colors">
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 md:px-10 py-14 md:py-20">
        <div className="mb-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-red">
            Legal
          </p>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-5 text-chalk-muted leading-relaxed">
            Effective date: September 9, 2026
          </p>
          <p className="mt-6 text-chalk-muted leading-relaxed">
            Please read these Terms carefully before using Dexmy. They explain the rules for using our educational platform, tutoring services, packages, bookings, classrooms, and related features.
          </p>
        </div>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title} className="border-b border-chalk-faint pb-10 last:border-b-0">
              <h2 className="text-xl md:text-2xl font-semibold text-chalk">
                {section.title}
              </h2>
              <div className="mt-4 space-y-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm md:text-base text-chalk-muted leading-7">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-chalk-faint bg-panel p-6">
          <p className="text-sm text-chalk-muted leading-6">
            These Terms are provided as a general website terms framework and should be reviewed by qualified legal counsel before being relied upon as Dexmy's final legal agreement.
          </p>
        </div>
      </main>
    </div>
  );
}
