"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Card = { title: string; summary: string; details: string };

export function ExpandableCards({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Home");
  const common = useTranslations("Common");
  const cards = t.raw("cards") as Card[];
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section className="learning-section" aria-labelledby="learning-heading">
      <div className="section-heading-row">
        
        <h2 id="learning-heading">{t("learnSection")}</h2>
      </div>
      <div className="learning-list">
        {cards.map((card, index) => {
          const isExpanded = expanded === index;
          return (
            <article className={`learning-card learning-card-${index + 1}`} key={card.title}>
              <div className="learning-card-top">
                
                <h3>{card.title}</h3>
              </div>
              <p>{card.summary}</p>
              {isExpanded && (
                <div className="card-expanded-content">
                  <p className="card-details">{card.details}</p>
                  {index === 1 && <div className="foster-interest-inline">{children}</div>}
                </div>
              )}
              <button
                className="text-button"
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpanded(isExpanded ? null : index)}
              >
                {isExpanded ? common("showLess") : common("learnMore")}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
