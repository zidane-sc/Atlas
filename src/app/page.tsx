import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth");
  }

  const user = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (user) {
    const setting = await db.setting.findUnique({
      where: { userId_key: { userId: user.id, key: "defaultView" } },
    });
    const defaultView = (setting?.value as string) || "dashboard";
    if (defaultView === "kanban") {
      redirect("/tasks");
    } else if (defaultView === "today") {
      redirect("/tasks/today");
    } else if (defaultView === "focus") {
      redirect("/tasks/focus");
    }
  }

  redirect("/dashboard");
}
