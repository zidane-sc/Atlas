import { redirect } from "next/navigation";
import { StatisticsPage } from "@/components/statistics/StatisticsPage";
import { getStatisticsPageData } from "@/lib/statistics-data";

export default async function Page() {
  const stats = await getStatisticsPageData();
  if (!stats) redirect("/auth");
  return <StatisticsPage stats={stats} />;
}
