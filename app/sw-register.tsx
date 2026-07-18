"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("SW OK", reg))
        .catch((err) => console.error("SW FAIL", err));
    }
  }, []);

  return null;
}
