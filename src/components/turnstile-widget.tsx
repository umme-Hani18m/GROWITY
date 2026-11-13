"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function TurnstileWidget({ siteKey, label }: { siteKey?: string; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !siteKey || !container.current || !window.turnstile || widgetId.current) return;
    const turnstile = window.turnstile;
    const setToken = (token: string) => {
      const form = container.current?.closest("form");
      const input = form?.querySelector<HTMLInputElement>("input[name='captchaToken']");
      if (input) input.value = token;
    };
    widgetId.current = turnstile.render(container.current, {
      sitekey: siteKey,
      callback: setToken,
      "expired-callback": () => setToken(""),
      "error-callback": () => setToken("")
    });
    return () => {
      if (widgetId.current) turnstile.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [ready, siteKey]);

  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={container} className="turnstile-slot" role="group" aria-label={label} />
      <input type="hidden" name="captchaToken" />
    </>
  );
}
