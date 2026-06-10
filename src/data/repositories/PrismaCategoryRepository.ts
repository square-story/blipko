import { Category, PrismaClient } from "@prisma/client";
import {
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
    return this.prisma.category.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        OR: [{ userId: null }, { userId }],
      },
    });
  }

  async create(data: CreateCategoryDTO): Promise<Category> {
    return this.prisma.category.create({
      data: { userId: data.userId, name: data.name, bucket: data.bucket },
    });
  }
}
