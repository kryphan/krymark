// Archetype: A Dashboard · dark (Kry UI) — v2 shell
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/pb";
import { Topbar } from "@/components/topbar";
import { CreateProjectForm } from "./create-form";
import { resolveOrgs } from "@/lib/org";

type Project = { id: string; name: string; widget_key: string; created: string };

export default async function ProjectsPage() {
  const pb = await createClient();
  if (!pb.authStore.isValid) redirect("/login");

  const { activeId, orgs } = await resolveOrgs(pb);
  let projects: Project[] = [];
  try {
    projects = await pb.collection("projects").getFullList<Project>({
      filter: activeId ? `org="${activeId}"` : "",
      sort: "-created",
    });
  } catch {
    redirect("/login");
  }
  const email = (pb.authStore.record as { email?: string })?.email;

  return (
    <>
      <Topbar
        userEmail={email}
        orgs={orgs}
        activeOrg={activeId}
        actions={
          <Link href="/team" className="btn-ghost btn-sm">
            Team
          </Link>
        }
      />
      <main className="shell" style={{ maxWidth: 860 }}>
        <div className="page-head">
          <p className="eyebrow">◉ Workspace</p>
          <h1 className="headline">
            Projects <span className="accent">— one per site</span>
          </h1>
        </div>
        <CreateProjectForm />
        {projects.length === 0 ? (
          <div className="empty">No projects yet — create one above and get your embed snippet right away.</div>
        ) : (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/p/${p.id}`} style={{ textDecoration: "none", fontWeight: 600 }}>
                  {p.name}
                </Link>
                <span className="key">{p.widget_key}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
