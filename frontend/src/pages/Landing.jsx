import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";
import About from "../components/About";
import Contact from "../components/Contact";
import Footer from "../components/Footer";
import AcademicTracks from "../components/AcademicTracks";
import SEO from "../components/SEO";

export default function Landing() {
  return (
    <div className="relative">
      <SEO
        title="Dexmy | 1-on-1 Live Online Tutoring for SAT, AP, IB, IGCSE & More"
        description="Dexmy provides 1-on-1 live online tutoring for SAT, PSAT, AP, TMUA, CBSE, ICSE, IGCSE, IB MYP and GCSE students with dedicated teachers and personalized learning."
        path="/"
      />
      <div className="chalk-texture-bg fixed inset-0 pointer-events-none z-[1]" />

      <Navbar />
      <main>
        <Hero />
        <AcademicTracks />
        <About />
        <Features />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
