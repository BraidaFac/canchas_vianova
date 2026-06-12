import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TurnosSection from "@/components/TurnosSection";
import CanchasSection from "@/components/CanchasSection";
import ServiciosSection from "@/components/ServiciosSection";
import ComoReservarSection from "@/components/ComoReservarSection";
import ContactoSection from "@/components/ContactoSection";
import Footer from "@/components/Footer";
import ChatBot from "@/components/ChatBot";

export default function Page() {
  return (
    <main>
      <Navbar />
      <Hero />
      <TurnosSection />
      <CanchasSection />
      <ServiciosSection />
      <ComoReservarSection />
      <ContactoSection />
      <Footer />
      <ChatBot />
    </main>
  );
}
