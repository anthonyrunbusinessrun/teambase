import { TopBar } from "@/components/layout/TopBar";
import { BackButton } from "@/components/layout/BackButton";
import { NewTaskForm } from "@/components/tasks/NewTaskForm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const metadata = { title: "New Task" };

async function getUsers() {
  return db.select({ id: users.id, name: users.name }).from(users);
}

export default async function NewTaskPage() {
  const allUsers = await getUsers();
  return (
    <>
      <TopBar title="New Task" left={<BackButton />} />
      <div className="page-content">
        <div className="max-w-lg">
          <NewTaskForm users={allUsers} />
        </div>
      </div>
    </>
  );
}
