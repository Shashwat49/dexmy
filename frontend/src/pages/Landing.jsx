import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Features from "../components/Features";

export default function Landing() {
  return (
    <div className="relative">
      {/* faint chalk-grid texture across the whole page */}
      <div className="chalk-texture-bg fixed inset-0 pointer-events-none z-[1]" />

      <Navbar />
      <Hero />
      <Features />
    </div>
  );
}
