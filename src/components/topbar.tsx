// Shell v2 — topbar sticky dùng chung mọi trang authed (archetype A)
import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import { OrgSwitcher } from "./org-switcher";
import type { OrgLite } from "@/lib/org";

export function Topbar({
  crumb,
  userEmail,
  actions,
  orgs,
  activeOrg,
}: {
  crumb?: { href: string; label: string }[];
  userEmail?: string;
  actions?: React.ReactNode;
  orgs?: OrgLite[];
  activeOrg?: string;
}) {
  return (
    <div className="topbar">
      <div className="topbar-in">
        <Link href="/projects" className="wordmark">
          kry<b>mark</b>
        </Link>
        {crumb?.map((c, i) => (
          <span key={c.href} style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <span className="tb-sep" />
            <Link href={c.href} className="crumb">
              {i === crumb.length - 1 ? <b>{c.label}</b> : c.label}
            </Link>
          </span>
        ))}
        <div className="tb-right">
          {orgs && activeOrg && <OrgSwitcher orgs={orgs} activeId={activeOrg} />}
          {actions}
          {userEmail && <span className="tb-user">{userEmail}</span>}
          <form action={logout}>
            <button className="btn-ghost btn-sm">Log out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
