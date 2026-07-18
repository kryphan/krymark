"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setActiveOrg(orgId: string) {
  (await cookies()).set("km_org", orgId.replace(/[^a-z0-9]/gi, ""), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
