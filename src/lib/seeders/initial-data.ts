import { db } from "@/lib/db";
import type { ProjectCategory, ProjectStatus, SprintStatus } from "@/generated/prisma/client";

export interface SeedResult {
  success: boolean;
  error?: string;
  projectIds?: { fullTime: string; university: string; sideProject: string };
  sprintId?: string;
}

export async function seedInitialData(userId: string): Promise<SeedResult> {
  try {
    // Use a transaction to ensure atomic check-and-create
    return await db.$transaction(async (tx) => {
      // Check if already seeded
      const existingProjects = await tx.project.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true },
      });

      if (existingProjects.length > 0) {
        // Already seeded, return existing
        const existingSprints = await tx.sprint.findMany({
          where: { ownerId: userId },
          select: { id: true },
        });
        return {
          success: true,
          projectIds: {
            fullTime: existingProjects.find(p => p.name === "My Full-Time Job")?.id || "",
            university: existingProjects.find(p => p.name === "University Courses")?.id || "",
            sideProject: existingProjects.find(p => p.name === "Personal Side Project")?.id || "",
          },
          sprintId: existingSprints[0]?.id,
        };
      }

      // Create projects
      const projects = await tx.project.createMany({
        data: [
          {
            ownerId: userId,
            name: "My Full-Time Job",
            category: "FullTime" as ProjectCategory,
            colorVar: "--color-priority-p0",
            emoji: "🏢",
            description: "Work tasks — rename to your actual job",
            status: "active" as ProjectStatus,
          },
          {
            ownerId: userId,
            name: "University Courses",
            category: "University" as ProjectCategory,
            colorVar: "--color-status-waiting-external",
            emoji: "🎓",
            description: "Study and coursework — rename to your school",
            status: "active" as ProjectStatus,
          },
          {
            ownerId: userId,
            name: "Personal Side Project",
            category: "SideProject" as ProjectCategory,
            colorVar: "--color-status-ready",
            emoji: "🚀",
            description: "My side project — rename to your project",
            status: "active" as ProjectStatus,
          },
        ],
      });

      // Get created project IDs
      const createdProjects = await tx.project.findMany({
        where: {
          ownerId: userId,
          name: { in: ["My Full-Time Job", "University Courses", "Personal Side Project"] },
        },
        select: { id: true, name: true },
      });

      const projectMap = createdProjects.reduce(
        (acc, p) => {
          if (p.name === "My Full-Time Job") acc.fullTime = p.id;
          if (p.name === "University Courses") acc.university = p.id;
          if (p.name === "Personal Side Project") acc.sideProject = p.id;
          return acc;
        },
        { fullTime: "", university: "", sideProject: "" }
      );

      // Create sprint
      const today = new Date();
      const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

      const seedProjectId = projectMap.sideProject || projectMap.fullTime;
      const sprint = await tx.sprint.create({
        data: {
          ownerId: userId,
          name: "Current Sprint",
          projects: seedProjectId ? { connect: [{ id: seedProjectId }] } : undefined,
          startDate: today,
          endDate: twoWeeksLater,
          status: "active" as SprintStatus,
          goal: "Rename this sprint and set your goals",
        },
        select: { id: true },
      });

      return {
        success: true,
        projectIds: projectMap,
        sprintId: sprint.id,
      };
    });
  } catch (error) {
    console.error("Failed to seed initial data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
