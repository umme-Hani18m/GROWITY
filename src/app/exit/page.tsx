"use client";

import Link from "next/link";
import en from "../../../messages/en.json";

export default function ExitPage() {
  return (
    <main className="exit-page" aria-labelledby="exit-heading">
      <div className="exit-card">
        <h1 id="exit-heading">{en.Common.exitComplete}</h1>
      <Link className="button button-primary" href="/en" onClick={() => window.sessionStorage.removeItem("growity-quick-exit")}>{en.Common.returnHome}</Link>
      </div>
    </main>
  );
}
