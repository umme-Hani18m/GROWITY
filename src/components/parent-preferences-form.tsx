"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveParentPreferences } from "@/app/parent-actions";
import { initialActionState } from "@/lib/action-state";

type Props = { preferredReligion: string; preferredAgeMin: number | null; preferredAgeMax: number | null };

export function ParentPreferencesForm({ preferredReligion, preferredAgeMin, preferredAgeMax }: Props) {
  const t = useTranslations("Parent");
  const common = useTranslations("Common");
  const [state, action, pending] = useActionState(saveParentPreferences, initialActionState);
  return (
    <form className="form-card preference-form" action={action}>
      <label>
        <span>{t("preferredReligion")}</span>
        <input name="preferredReligion" maxLength={80} defaultValue={preferredReligion} autoComplete="off" />
      </label>
      <label>
        <span>{t("preferredAgeMin")}</span>
        <input type="number" name="preferredAgeMin" min={0} max={18} defaultValue={preferredAgeMin ?? ""} inputMode="numeric" />
      </label>
      <label>
        <span>{t("preferredAgeMax")}</span>
        <input type="number" name="preferredAgeMax" min={0} max={18} defaultValue={preferredAgeMax ?? ""} inputMode="numeric" />
      </label>
      <button className="button button-secondary" type="submit" disabled={pending}>{pending ? common("processing") : t("savePreferences")}</button>
      {state.status === "success" && <p className="form-status" role="status">{t("preferencesSaved")}</p>}
      {state.status === "error" && <p className="form-status" role="alert">{common("requestFailed")}</p>}
      {state.status === "setup" && <p className="form-status" role="alert">{common("setupRequired")}</p>}
    </form>
  );
}
