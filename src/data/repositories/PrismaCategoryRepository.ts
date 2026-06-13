import { Category, PrismaClient } from "@prisma/client";
import {
  CloneGroupInput,
  CreateCategoryDTO,
  ICategoryRepository,
} from "../../domain/repositories/ICategoryRepository";

export class PrismaCategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAllForUser(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: "asc" },
    });
  }

  async findByNameForUser(
    userId: string,
    name: string,
  ): Promise<Category | null> {
    const matches = await this.prisma.category.findMany({
      where: {
        name: { equals: name, mode: "insensitive" },
        OR: [{ userId: null }, { userId }],
      },
    });
    // Prefer the user's own row over the shared system template.
    return matches.find((c) => c.userId === userId) ?? matches[0] ?? null;
  }

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  async create(data: CreateCategoryDTO): Promise<Category> {
    return this.prisma.category.create({
      data: {
        userId: data.userId,
        name: data.name,
        bucket: data.bucket,
        isGroup: data.isGroup ?? false,
        parentId: data.parentId ?? null,
        monthlyBudget: data.monthlyBudget ?? null,
      },
    });
  }

  async cloneGroupsForUser(
    userId: string,
    groups: CloneGroupInput[],
  ): Promise<number> {
    let leaves = 0;
    for (const group of groups) {
      // Idempotent: skip a group the user already owns.
      const existingGroup = await this.prisma.category.findFirst({
        where: { userId, name: group.name },
      });
      const groupRow =
        existingGroup ??
        (await this.prisma.category.create({
          data: {
            userId,
            name: group.name,
            bucket: group.bucket,
            isGroup: true,
          },
        }));

      for (const child of group.children) {
        const exists = await this.prisma.category.findFirst({
          where: { userId, name: child.name },
        });
        if (exists) continue;
        await this.prisma.category.create({
          data: {
            userId,
            name: child.name,
            bucket: child.bucket,
            parentId: groupRow.id,
            monthlyBudget: child.monthlyBudget ?? null,
          },
        });
        leaves++;
      }
    }
    return leaves;
  }
}
