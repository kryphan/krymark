/// <reference path="../pb_data/types.d.ts" />
// Org auto-create khi signup (D7) — thay trigger handle_new_user của bản Supabase.
// User mới → tạo org (tên = phần trước @ của email) + members(role=owner).

onRecordCreateRequest((e) => {
  e.next(); // để PB tạo user xong đã

  const user = e.record;
  const orgsCol = e.app.findCollectionByNameOrId("orgs");
  const org = new Record(orgsCol);
  const email = user.email() || "";
  org.set("name", email.split("@")[0] || "workspace");
  org.set("plan", "free");
  e.app.save(org);

  const membersCol = e.app.findCollectionByNameOrId("members");
  const member = new Record(membersCol);
  member.set("org", org.id);
  member.set("user", user.id);
  member.set("role", "owner");
  e.app.save(member);
}, "users");
