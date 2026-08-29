import { useState } from "react";
import api from "../api/client";

function ContactIcon({ type }) {
  if (type === "email") {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
  }
  if (type === "whatsapp") {
    return <svg aria-hidden="true" viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor"><path d="M12 2a9.9 9.9 0 0 0-8.58 14.86L2 22l5.3-1.39A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.07-1.11l-.29-.17-3.15.83.84-3.07-.19-.31A8 8 0 1 1 12 20Zm4.4-5.92c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-1.4-.7-2.32-1.25-3.25-2.83-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62 1.52.66 2.12.72 2.88.61.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" /></svg>;
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.6 2.9h2.2l1.1 5-1.8 1.8a15.4 15.4 0 0 0 6.2 6.2l1.8-1.8 5 1.1v2.2c0 1.1-.9 2-2 2C11.3 19.4 4.6 12.7 4.6 4.9c0-1.1.9-2 2-2Z" /></svg>;
}

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault(); setStatus("");
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) { setStatus("Please complete all required fields."); return; }
    setSubmitting(true);
    try {
      await api.post("/contact", { name: form.name.trim(), email: form.email.trim(), message: form.message.trim() });
      setForm({ name: "", email: "", message: "" }); setStatus("Thanks — your message has been sent.");
    } catch (err) { setStatus(err.response?.data?.detail || "We couldn't send your message. Please try again."); }
    finally { setSubmitting(false); }
  }

  return <section id="contact" className="relative z-[3] py-24 px-6 md:px-12 bg-panel-2 border-t border-chalk-faint">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl mx-auto text-center mb-14">
        <p className="text-sm font-semibold tracking-[2px] uppercase text-brand-gold mb-4">Contact Us</p>
        <h2 className="font-display text-4xl md:text-5xl tracking-tight leading-tight">Let's talk about <span className="text-brand-red">learning.</span></h2>
        <p className="text-chalk-muted text-base md:text-lg leading-relaxed mt-6">Have a question about Dexmy, our classes, or becoming a tutor? We'd love to hear from you.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-panel border border-chalk-faint rounded-2xl p-8 md:p-10">
          <p className="text-brand-gold text-sm font-semibold uppercase tracking-[1.5px] mb-5">Get in touch</p>
          <h3 className="font-display text-3xl md:text-4xl leading-tight mb-6">We're here to help.</h3>
          <p className="text-chalk-muted leading-relaxed mb-8">Whether you're a student, parent, tutor, or partner, feel free to reach out.</p>
          <div className="space-y-4">
            <a href="mailto:dexmyedu@gmail.com" aria-label="Email Dexmy at dexmyedu@gmail.com" className="group flex items-center gap-4 rounded-xl border border-chalk-faint bg-panel-2 p-4 text-chalk hover:border-brand-gold hover:text-brand-gold transition-all">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-red-soft text-brand-red group-hover:bg-brand-red group-hover:text-white transition-colors"><ContactIcon type="email" /></span>
              <span><span className="block text-xs uppercase tracking-[1.5px] text-chalk-muted mb-1">Email us</span><span className="font-medium">dexmyedu@gmail.com</span></span>
            </a>
            <a href="https://wa.me/918929839177" target="_blank" rel="noreferrer" aria-label="Chat with Dexmy on WhatsApp" className="group flex items-center gap-4 rounded-xl border border-chalk-faint bg-panel-2 p-4 text-chalk hover:border-brand-gold hover:text-brand-gold transition-all">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-red-soft text-brand-red group-hover:bg-brand-red group-hover:text-white transition-colors"><ContactIcon type="whatsapp" /></span>
              <span><span className="block text-xs uppercase tracking-[1.5px] text-chalk-muted mb-1">WhatsApp</span><span className="font-medium">Chat with us on WhatsApp</span></span>
            </a>
            <a href="tel:+918929839177" aria-label="Call Dexmy at +91 89298 39177" className="group flex items-center gap-4 rounded-xl border border-chalk-faint bg-panel-2 p-4 text-chalk hover:border-brand-gold hover:text-brand-gold transition-all">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-red-soft text-brand-red group-hover:bg-brand-red group-hover:text-white transition-colors"><ContactIcon type="phone" /></span>
              <span><span className="block text-xs uppercase tracking-[1.5px] text-chalk-muted mb-1">Call us</span><span className="font-medium">+91 89298 39177</span></span>
            </a>
          </div>
        </div>
        <div className="bg-panel border border-chalk-faint rounded-2xl p-8 md:p-10">
          <p className="text-brand-gold text-sm font-semibold uppercase tracking-[1.5px] mb-5">Send a message</p>
          <h3 className="font-display text-2xl md:text-3xl mb-7">How can we help?</h3>
          <form onSubmit={submit} className="space-y-5">
            <div><label htmlFor="contact-name" className="block text-sm font-medium text-chalk mb-2">Full name</label><input id="contact-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required type="text" placeholder="Your name" className="w-full px-4 py-3 rounded-lg bg-panel-2 border border-chalk-faint text-chalk placeholder:text-chalk-faint outline-none focus:border-brand-red transition-colors" /></div>
            <div><label htmlFor="contact-email" className="block text-sm font-medium text-chalk mb-2">Email address</label><input id="contact-email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required type="email" placeholder="you@example.com" className="w-full px-4 py-3 rounded-lg bg-panel-2 border border-chalk-faint text-chalk placeholder:text-chalk-faint outline-none focus:border-brand-red transition-colors" /></div>
            <div><label htmlFor="contact-message" className="block text-sm font-medium text-chalk mb-2">Message</label><textarea id="contact-message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required rows="5" placeholder="Tell us how we can help..." className="w-full px-4 py-3 rounded-lg bg-panel-2 border border-chalk-faint text-chalk placeholder:text-chalk-faint outline-none focus:border-brand-red transition-colors resize-none" /></div>
            {status && <p className="text-sm text-chalk-muted" role="status">{status}</p>}
            <button disabled={submitting} type="submit" className="w-full py-3.5 rounded-lg bg-brand-red text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">{submitting ? "Sending…" : "Send message"}</button>
          </form>
        </div>
      </div>
    </div>
  </section>;
}
