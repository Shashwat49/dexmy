import { Link } from "react-router-dom";
import SEO from "../components/SEO";

const sections = [
  {
    title: "1. Information We Collect",
    content: (
      <>
        <p>When you use Dexmy, we may collect information that you provide directly to us and information generated through your use of our services.</p>
        <ul>
          <li><strong>Account information:</strong> name, email address, phone number, password or authentication credentials, role, and profile details.</li>
          <li><strong>Student and academic information:</strong> grade or year, subjects, exam or curriculum preferences, learning goals, class information, notes, and other information you choose to provide for educational purposes.</li>
          <li><strong>Booking and service information:</strong> selected classes, tutors, schedules, package details, attendance, classroom activity, and support requests.</li>
          <li><strong>Payment information:</strong> transaction details such as payment status, amount, currency, order or transaction identifiers, and related billing information. Payment card, banking, or other sensitive payment credentials may be processed directly by our payment service providers and are not intended to be stored by Dexmy unless expressly stated.</li>
          <li><strong>Technical information:</strong> IP address, browser and device information, operating system, approximate location derived from technical data, pages visited, referring pages, timestamps, and diagnostic or usage information.</li>
          <li><strong>Communications:</strong> messages, feedback, enquiries, and information you provide when contacting Dexmy or using support features.</li>
        </ul>
      </>
    ),
  },
  {
    title: "2. How We Use Your Information",
    content: (
      <>
        <p>We use information we collect to operate, maintain, and improve Dexmy and to provide our educational services. This may include:</p>
        <ul>
          <li>Creating and managing user accounts.</li>
          <li>Providing tutoring, classes, bookings, classrooms, packages, and related educational services.</li>
          <li>Connecting students with tutors and enabling communication necessary to deliver classes.</li>
          <li>Processing payments, maintaining transaction records, and preventing fraud or unauthorized activity.</li>
          <li>Sending service-related notifications, confirmations, reminders, security alerts, and important account updates.</li>
          <li>Responding to support requests and resolving disputes or technical problems.</li>
          <li>Understanding usage, improving our website and services, and developing new features.</li>
          <li>Protecting the security, integrity, and availability of our platform.</li>
          <li>Complying with applicable laws, regulations, legal processes, and legitimate requests from authorities.</li>
        </ul>
      </>
    ),
  },
  {
    title: "3. Legal Basis and Consent",
    content: (
      <p>Depending on the applicable law and the circumstances, we may process personal information based on your consent, to provide a service you request, to perform or administer a contract or transaction, to comply with legal obligations, or for legitimate operational and security purposes where permitted by law. Where consent is required, you may withdraw it subject to applicable legal and contractual limitations.</p>
    ),
  },
  {
    title: "4. Sharing of Information",
    content: (
      <>
        <p>Dexmy does not sell your personal information as a business practice. We may share information when reasonably necessary to provide and protect our services, including with:</p>
        <ul>
          <li><strong>Tutors and authorized users:</strong> information necessary to conduct and manage educational sessions.</li>
          <li><strong>Service providers:</strong> hosting, cloud infrastructure, analytics, communications, authentication, payment processing, customer support, and other vendors that help operate Dexmy.</li>
          <li><strong>Professional or legal advisers:</strong> where necessary to obtain professional advice or protect our rights.</li>
          <li><strong>Authorities or other parties:</strong> when required by law, legal process, or where reasonably necessary to prevent fraud, abuse, security incidents, or harm.</li>
          <li><strong>Business transfers:</strong> in connection with a merger, acquisition, financing, restructuring, sale of assets, or similar transaction, subject to applicable law.</li>
        </ul>
        <p>Third-party providers may process information under their own privacy policies and terms. We encourage users to review the policies of services they interact with.</p>
      </>
    ),
  },
  {
    title: "5. Payments and Package Policy",
    content: (
      <>
        <p>Payments made through Dexmy may be processed by third-party payment providers. Dexmy may receive transaction and payment-status information needed to confirm and administer a purchase.</p>
        <p><strong>All payments for purchased tutoring packages are final and non-refundable.</strong> Once a package has been paid for, the amount paid will not be refunded, cancelled, exchanged, or transferred to another package for any reason, including unused classes, change of plans, scheduling difficulties, dissatisfaction, or discontinuation of use, except where a refund or other remedy is mandatorily required under applicable law.</p>
      </>
    ),
  },
  {
    title: "6. Cookies and Similar Technologies",
    content: (
      <p>Dexmy may use cookies, local storage, session technologies, and similar mechanisms to keep you signed in, maintain preferences, provide security, understand website usage, and improve functionality. Some technologies may be placed or operated by service providers used by Dexmy. You can manage cookies through your browser settings, although disabling certain technologies may affect website functionality.</p>
    ),
  },
  {
    title: "7. Data Security",
    content: (
      <p>We use reasonable technical, administrative, and organizational safeguards designed to protect personal information against unauthorized access, loss, misuse, alteration, or disclosure. However, no website, internet transmission, or storage system can be guaranteed to be completely secure. You are responsible for keeping your account credentials confidential and for notifying us if you believe your account has been compromised.</p>
    ),
  },
  {
    title: "8. Data Retention",
    content: (
      <p>We retain personal information for as long as reasonably necessary to provide our services, maintain business and transaction records, resolve disputes, enforce agreements, comply with legal obligations, and protect our legitimate interests. Retention periods may vary depending on the type and purpose of the information.</p>
    ),
  },
  {
    title: "9. Your Privacy Rights",
    content: (
      <p>Depending on your location and applicable law, you may have rights regarding your personal information, including the right to request access, correction, deletion, withdrawal of consent, information about processing, or other legally available remedies. Requests can be made through our contact details below. We may need to verify your identity before completing a request, and certain legal exceptions or retention requirements may apply.</p>
    ),
  },
  {
    title: "10. Children's Privacy",
    content: (
      <p>Dexmy may provide educational services to students who are minors. Where a user is a child or minor, the service should be used with the involvement, authorization, or supervision of a parent or legal guardian where required by applicable law. We do not knowingly seek unnecessary personal information from children. If you believe a child has provided personal information inappropriately, please contact us so that we can review and take appropriate action.</p>
    ),
  },
  {
    title: "11. International Data Processing",
    content: (
      <p>Because Dexmy may serve students and tutors in different countries and may use service providers located in different jurisdictions, personal information may be processed or stored outside the country in which you live. Where required, we will use appropriate safeguards for such transfers in accordance with applicable law.</p>
    ),
  },
  {
    title: "12. Third-Party Links and Services",
    content: (
      <p>Our website may contain links to third-party websites, applications, payment services, communication tools, or other services. Dexmy is not responsible for the privacy practices or content of third parties. Their own privacy policies and terms apply when you use their services.</p>
    ),
  },
  {
    title: "13. Changes to This Privacy Policy",
    content: (
      <p>We may update this Privacy Policy from time to time to reflect changes in our services, technology, legal requirements, or business practices. The updated version will be posted on this page with a revised effective date. Your continued use of Dexmy after an update means you acknowledge the updated policy to the extent permitted by applicable law.</p>
    ),
  },
  {
    title: "14. Contact Us",
    content: (
      <>
        <p>If you have questions, privacy requests, or concerns about this Privacy Policy or the way Dexmy handles personal information, please contact us:</p>
        <p><strong>Email:</strong> <a href="mailto:dexmyedu@gmail.com" className="text-brand-red hover:underline">dexmyedu@gmail.com</a></p>
      </>
    ),
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-void text-chalk">
      <SEO
        title="Privacy Policy | Dexmy"
        description="Read the Dexmy Privacy Policy covering personal information, payments, cookies, security, data rights, and educational services."
        path="/privacy"
      />

      <header className="border-b border-chalk-faint px-6 py-5">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <Link to="/" className="font-display text-2xl text-brand-red -skew-x-6">Dexmy</Link>
          <Link to="/" className="text-sm text-chalk-muted hover:text-chalk">Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 md:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-red">Legal & Privacy</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-5 text-chalk-muted leading-relaxed">This Privacy Policy explains how Dexmy collects, uses, stores, and shares information when you use our website, tutoring services, classes, packages, classrooms, and related services.</p>
          <p className="mt-3 text-xs text-chalk-faint">Effective date: September 9, 2026</p>
        </div>

        <div className="mt-12 space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-chalk-faint bg-panel p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm md:text-base text-chalk-muted leading-7 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_strong]:text-chalk">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 text-sm text-chalk-muted">
          <Link to="/terms" className="text-brand-red hover:underline">View Terms of Service</Link>
        </div>
      </main>
    </div>
  );
}
