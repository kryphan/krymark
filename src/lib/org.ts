import { cookies } from "next/headers";
import type PocketBase from "pocketbase";

// Org đang active (D7: 1 user nhiều org). Cookie km_org, fallback org đầu.
// Trả list org của user để topbar render switcher khi >1.
export type OrgLite = { id: string; name: string };

export async function resolveOrgs(pb: PocketBase): Promise<{ activeId: string; orgs: OrgLite[] }> {
  const userId = (pb.authStore.record as { id: string }).id;
  const members = await pb.collection("members").getFullList({ filter: `user="${userId}"`, expand: "org" });
  const orgs: OrgLite[] = members
    .map((m) => m.expand?.org as { id: string; name: string } | undefined)
    .filter((o): o is OrgLite => !!o)
    .map((o) => ({ id: o.id, name: o.name }));
  if (orgs.length === 0) return { activeId: "", orgs: [] };
  const cookieOrg = (await cookies()).get("km_org")?.value;
  const activeId = orgs.some((o) => o.id === cookieOrg) ? cookieOrg! : orgs[0].id;
  return { activeId, orgs };
}
