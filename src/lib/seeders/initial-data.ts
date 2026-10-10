import { db } from "@/lib/db";
import { ProjectCategory, ProjectStatus } from "@/generated/prisma/client";

export interface SeedResult {
  success: boolean;
  error?: string;
  projectIds?: { fullTime: string; university: string; sideProject: string };
}

export async function seedInitialData(userId: string): Promise<SeedResult> {
  try {
    return await db.$transaction(async (tx) => {
      // Check if already seeded
      const existingProjects = await tx.project.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true },
      });

      if (existingProjects.length > 0) {
        return {
          success: true,
          projectIds: {
            fullTime: existingProjects.find((p) => p.name === "My Full-Time Job")?.id || "",
            university: existingProjects.find((p) => p.name === "University Courses")?.id || "",
            sideProject: existingProjects.find((p) => p.name === "Personal Side Project")?.id || "",
          },
        };
      }

      // Create initial projects
      await tx.project.createMany({
        data: [
          {
            ownerId: userId,
            name: "My Full-Time Job",
            category: ProjectCategory.work,
            colorVar: "--color-primary-gold",
            emoji: "🏢",
            description: "Work tasks — rename to your actual job",
            status: ProjectStatus.active,
          },
          {
            ownerId: userId,
            name: "University Courses",
            category: ProjectCategory.learning,
            colorVar: "--color-primary-gold",
            emoji: "🎓",
            description: "Study and coursework — rename to your school",
            status: ProjectStatus.active,
          },
          {
            ownerId: userId,
            name: "Personal Side Project",
            category: ProjectCategory.personal,
            colorVar: "--color-primary-gold",
            emoji: "🚀",
            description: "My side project — rename to your project",
            status: ProjectStatus.active,
          },
        ],
      });

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

      return {
        success: true,
        projectIds: projectMap,
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
