import { getTranslations } from "next-intl/server";
import { PageContext } from "@/components/page-context";
import { StaffAuthForm } from "@/components/staff-auth-form";
import { StaffAgreementForm } from "@/components/staff-agreement-form";
import { StaffDashboard } from "@/components/staff-dashboards";
import { StaffGrievanceForm } from "@/components/staff-grievance-form";
import { QuickExit } from "@/components/quick-exit";
import { getStaffWorkspace } from "@/lib/staff-workspace";

const staffRoles = ["verification_team", "caseworker", "protection_officer", "grievance_committee", "admin"] as const;
type StaffRole = typeof staffRoles[number];

function isStaffRole(value: string | null): value is StaffRole {
  return value !== null && (staffRoles as readonly string[]).includes(value);
}

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Team");
  const common = await getTranslations("Common");
  const roles = t.raw("roles") as Array<{ name: string; description: string }>;
  const workspace = await getStaffWorkspace();

  return (
    <main id="main-content" className="page-main content-width role-page">
      <PageContext pageKey="team" />
      <section className="role-hero" aria-labelledby="team-title">
        
        <h1 id="team-title">{t("title")}</h1>
        <p className="role-lead">{t("intro")}</p>
      </section>
      {!workspace ? (
        <section className="portal-access"><div><h2>{t("login")}</h2><p>{t("mfa")}</p></div><StaffAuthForm locale={locale} /></section>
      ) : !workspace.available ? (
        <p className="empty-state" role="alert">{t("workspaceUnavailable")}</p>
      ) : !workspace.hasAgreement ? (
        <section className="portal-access"><div><h2>{t("agreementTitle")}</h2><p>{t("agreementRequired")}</p></div><StaffAgreementForm /></section>
      ) : (
        <section className="portal-access staff-authorized" aria-labelledby="staff-workspace-access">
          <div className="staff-quick-exit"><QuickExit /></div>
          <div><h2 id="staff-workspace-access">{t("dashboardTitle")}</h2><p>{t("mfaVerified")}</p></div>
          {isStaffRole(workspace.staff.profile.sub_role)
            ? <StaffDashboard role={workspace.staff.profile.sub_role} supabase={workspace.staff.supabase} userId={workspace.staff.user.id} />
            : <p className="empty-state" role="alert">{t("workspaceUnavailable")}</p>}
          <div className="staff-grievance"><h3>{t("grievanceTitle")}</h3><p>{t("grievanceDescription")}</p><StaffGrievanceForm /></div>
        </section>
      )}
      <section className="team-roles"><h2>{t("rolesTitle")}</h2><ul className="role-list">{roles.map((role) => <li key={role.name}><h3>{role.name}</h3><p>{role.description}</p></li>)}</ul></section>
      <section className="soft-panel"><h2>{t("grievanceTitle")}</h2><p>{t("directoryPrivacy")}</p><p>{common("disclaimer")}</p></section>
    </main>
  );
}
