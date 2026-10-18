"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Offers the browser's own "install this site" prompt where the browser supports it (Chrome and
 * Edge on Android and desktop). Elsewhere it renders nothing and the written steps apply.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="text-sm font-semibold text-emerald-700">Sukkot Salone is on your home screen.</p>;
  if (!prompt) return null;
  return (
    <Button
      variant="accent"
      size="lg"
      onClick={async () => {
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setPrompt(null);
      }}
    >
      <Download className="h-5 w-5" aria-hidden /> Add to home screen
    </Button>
  );
}
