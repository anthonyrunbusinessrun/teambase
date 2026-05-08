import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { TopBar } from "@/components/layout/TopBar";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata = { title: "My Profile" };

function getNameFromEmail(email: string): string {
  const local = email.split("@")[0];
  return local.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, session.user.id));

  // Derive name from email if not set
  const displayName = user?.name && user.name.trim()
    ? user.name
    : getNameFromEmail(session.user.email);

  return (
    <>
      <TopBar title="My Profile" subtitle="Account settings" />
      <div className="page-content">
        <div className="max-w-xl">
          <ProfileForm
            userId={session.user.id}
            email={session.user.email}
            currentName={displayName}
            currentPosition={profile?.positionTitle || ""}
            currentBio={profile?.bio || ""}
            currentPhone={profile?.phone || ""}
            currentLocation={profile?.location || ""}
            currentAvatar={user?.avatarUrl || profile?.avatarUrl || null}
          />
        </div>
      </div>
    </>
  );
}
