"use client";

import { useTransition } from "react";
import { setActiveOrg } from "@/app/actions";
import type { OrgLite } from "@/lib/org";

// Chỉ hiện khi user thuộc >1 org (D7). Đổi org = set cookie + refresh.
export function OrgSwitcher({ orgs, activeId }: { orgs: OrgLite[]; activeId: string }) {
  const [pending, start] = useTransition();
  if (orgs.length <= 1) return null;
  return (
    <select
      className="org-sw"
      value={activeId}
      disabled={pending}
      onChange={(e) => start(() => setActiveOrg(e.target.value))}
      aria-label="Switch workspace"
    >
      {orgs.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
