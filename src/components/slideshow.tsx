"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { homeSlides } from "@/lib/home-slides";

type Slide = { label: string; empty: string; alt: string; image?: string };

export function Slideshow() {
  const t = useTranslations("Home");
  const locale = useLocale();
  const slides = t.raw("slides") as Slide[];
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setPlaying(false);
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 1500);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, slides.length]);

  const slide = slides[index];
  const configuredSlide = homeSlides[index];
  const slideImage = configuredSlide?.src ?? slide.image;
  const slideAlt = configuredSlide?.alt[locale === "hi" ? "hi" : "en"] ?? slide.alt;
  const setRelative = (offset: number) => setIndex((current) => (current + offset + slides.length) % slides.length);

  return (
    <section className="slideshow" aria-label={t("slideshowLabel")}>
      {slideImage ? <div className="slide-image-frame"><img className="slide-image" src={slideImage} alt={slideAlt} /></div> : <div className="slide-placeholder" role="img" aria-label={slideAlt} aria-roledescription="photo placeholder">
        <span className="slide-index">{slide.label}</span>
        <p>{slide.empty}</p>
      </div>}
      <div className="slide-controls">
        <span aria-live="polite">{t("slideCount", { current: index + 1, total: slides.length })}</span>
        <div className="slide-buttons">
          <button type="button" onClick={() => setRelative(-1)} aria-label={t("previous")}>‹</button>
          <button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing && !reducedMotion ? t("pause") : t("play")}>
            {playing && !reducedMotion ? "Ⅱ" : "▶"}
          </button>
          <button type="button" onClick={() => setRelative(1)} aria-label={t("next")}>›</button>
        </div>
      </div>
    </section>
  );
}
