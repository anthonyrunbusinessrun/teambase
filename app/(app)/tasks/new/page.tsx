import { TopBar } from "@/components/layout/TopBar";
import { BackButton } from "@/components/layout/BackButton";
import { NewTaskForm } from "@/components/tasks/NewTaskForm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const metadata = { title: "New Task" };

async function getUsers() {
  return db.select({ id: users.id, fullName: users.fullName }).from(users);
}

export default async function NewTaskPage() {
  const allUsers = await getUsers();

  return (
    <>
      <TopBar title="New task" left={<BackButton />} />
      <main className="px-5 pt-4 pb-8">
        <NewTaskForm users={allUsers} />
      </main>
    </>
  );
}
