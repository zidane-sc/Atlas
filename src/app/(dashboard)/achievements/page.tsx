import { redirect } from "next/navigation";
import { AchievementsPage } from "@/components/gamification/AchievementsPage";
import { getAchievementsPageData } from "@/lib/achievements-data";

export default async function Page() {
  const achievements = await getAchievementsPageData();
  if (!achievements) redirect("/auth");
  return <AchievementsPage achievements={achievements} />;
}
