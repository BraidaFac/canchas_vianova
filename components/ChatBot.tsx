"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WA_NUMBER = "5434826783770";

interface Message {
  id: number;
  text: string;
  from: "bot" | "user";
}

const WELCOME_MESSAGE: Message = {
  id: 0,
  from: "bot",
  text: "¡Hola! 👋 Soy el asistente de Vía Nova. Puedo ayudarte a reservar una cancha, consultar disponibilidad o contarte sobre nuestros servicios. ¿En qué te ayudo?",
};

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: Date.now(), from: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Open WhatsApp with the message
    window.open(
      `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`,
      "_blank"
    );

    // Bot reply
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          from: "bot",
          text: "Te redirigí a WhatsApp para que puedas continuar la consulta con nuestro equipo. ¡Hasta pronto!",
        },
      ]);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-[min(380px,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ height: "520px" }}
          >
            {/* Header */}
            <div className="bg-[#133D34] px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Image
                  src="/blanco.png"
                  alt="Vía Nova"
                  width={72}
                  height={24}
                  className="h-7 w-auto object-contain"
                />
                <div>
                  <p className="text-white text-sm font-medium leading-none">
                    Asistente Virtual
                  </p>
                  <span className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-white/60 text-xs">En línea</span>
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="text-white hover:bg-white/10 h-8 w-8 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F8F6F1]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.from === "bot"
                        ? "bg-white text-[#1A1A1A] rounded-tl-none shadow-sm"
                        : "bg-[#133D34] text-white rounded-tr-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 bg-white border-t border-[#133D34]/10 flex gap-2 shrink-0">
              <Input
                placeholder="Escribí tu consulta..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 border-[#133D34]/20 focus-visible:ring-[#133D34] text-sm"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim()}
                className="bg-[#133D34] hover:bg-[#0f2e27] text-white shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <div className="flex flex-col items-center gap-1.5">
        <AnimatePresence>
          {!open && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 340, damping: 24 }}
              className="flex items-center gap-1.5 bg-green-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md"
            >
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-white shrink-0"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
              En línea
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setOpen((v) => !v)}
          title="Chateá con nuestro asistente"
          className="w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl cursor-pointer relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #133D34 0%, #1a5248 100%)" }}
          aria-label={open ? "Cerrar chat" : "Abrir chat"}
        >
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <motion.span
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="h-6 w-6" />
              </motion.span>
            ) : (
              <motion.span
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <MessageCircle className="h-6 w-6" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}
