"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function ChildVoiceHelp({ locale, text }: { locale: string; text: string }) {
  const t = useTranslations("Child");
  const [unsupported, setUnsupported] = useState(false);

  function speak() {
    if (!("speechSynthesis" in window)) {
      setUnsupported(true);
      return;
    }
    window.speechSynthesis.cancel();
    const message = new SpeechSynthesisUtterance(text);
    message.lang = locale === "hi" ? "hi-IN" : "en-IN";
    window.speechSynthesis.speak(message);
  }

  return (
    <div className="voice-help">
      <button className="button button-secondary" type="button" onClick={speak}>{t("audioHelp")}</button>
      {unsupported && <p role="status">{t("audioUnavailable")}</p>}
      <p>{t("languageSafety")}</p>
    </div>
  );
}
