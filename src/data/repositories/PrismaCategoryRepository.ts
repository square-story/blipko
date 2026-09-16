import { Category, Prisma, PrismaClient } from "@prisma/client";
import {
  CloneGroupInput,
  CreateCategoryDTO,
  ICategoryRepository,
} from "../../domain/repositories/ICategoryRepository";
import { categoryMatchKey } from "../../application/use-cases/categoryName";

// Prefer the user's own row over the shared system template (userId = null).
function preferOwn(rows: Category[], userId: string): Category | null {
  return rows.find((c) => c.userId === userId) ?? rows[0] ?? null;
}

export class PrismaCategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAllForUser(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      orderBy: { name: "asc" },
    });
  }

  // Resolves a name the AI produced to a row the user already has, so a spend
  // reuses "Eating Out" instead of minting "eating out" beside it. Two tiers,
  // and the order is load-bearing: an exact name always beats a looser key
  // match, otherwise a user's own near-miss row would win over the system row
  // the name actually names. Ownership only breaks ties WITHIN a tier.
  async findByNameForUser(
    userId: string,
    name: string,
  ): Promise<Category | null> {
    const rows = await this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }] },
      // Deterministic pick when a user already owns both "Snack" and "Snacks".
      orderBy: { name: "asc" },
    });

    const exact = preferOwn(
      rows.filter((c) => c.name.toLowerCase() === name.toLowerCase()),
      userId,
    );
    if (exact) return exact;

    // Groups are containers an expense can never attach to, so they match by
    // exact name only. Letting "food and drinks" key-match the GROUP "Food &
    // Drinks" would send the spend to silently uncategorized — worse than the
    // stray leaf it replaces, because nobody notices a hole in the data.
    const key = categoryMatchKey(name);
    return preferOwn(
      rows.filter((c) => !c.isGroup && categoryMatchKey(c.name) === key),
      userId,
    );
  }

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  async create(data: CreateCategoryDTO): Promise<Category> {
    try {
      return await this.prisma.category.create({
        data: {
          userId: data.userId,
          name: data.name,
          bucket: data.bucket,
          isGroup: data.isGroup ?? false,
          parentId: data.parentId ?? null,
          monthlyBudget: data.monthlyBudget ?? null,
        },
      });
    } catch (e) {
      // Callers look the name up and then create, which is not atomic — and
      // BatchProcessor loops up to 12 items. Two concurrent messages naming the
      // same new category race on @@unique([userId, name]). Losing the race
      // means the row exists now, so return it instead of failing the message.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const raced = await this.prisma.category.findUnique({
          where: { userId_name: { userId: data.userId, name: data.name } },
        });
        if (raced) return raced;
      }
      throw e;
    }
  }

  // Turn a shared system row into a category the user actually owns, the first
  // time a spend lands on it. Onboarding no longer pre-clones the taxonomy, so
  // without this an expense keeps a userId=null categoryId — which the web
  // ownership checks reject (editing a recurring rule would silently drop its
  // category) and which the dashboard's self-heal would later clone flat, with
  // no parent group.
  //
  // Upserts on @@unique([userId, name]), so two concurrent messages naming the
  // same category cannot race here the way a find-then-create can.
  async materializeForUser(
    userId: string,
    systemCategoryId: string,
  ): Promise<Category> {
    const system = await this.prisma.category.findUnique({
      where: { id: systemCategoryId },
    });
    if (!system) throw new Error(`No category ${systemCategoryId}`);
    // Already the user's own row (or someone else's) — nothing to materialize.
    if (system.userId !== null) return system;

    // Keep the leaf under a group the USER owns; system.parentId points at the
    // shared group, which they cannot rename or budget.
    let parentId: string | null = null;
    if (system.parentId) {
      const systemParent = await this.prisma.category.findUnique({
        where: { id: system.parentId },
      });
      if (systemParent) {
        const ownParent = await this.prisma.category.upsert({
          where: {
            userId_name: { userId, name: systemParent.name },
          },
          update: {},
          create: {
            userId,
            name: systemParent.name,
            bucket: systemParent.bucket,
            isGroup: true,
            icon: systemParent.icon,
          },
        });
        parentId = ownParent.id;
      }
    }

    return this.prisma.category.upsert({
      where: { userId_name: { userId, name: system.name } },
      update: {},
      create: {
        userId,
        name: system.name,
        bucket: system.bucket,
        isGroup: system.isGroup,
        parentId,
        weight: system.weight,
        icon: system.icon,
        // Deliberately uncapped. The system weight is a share of a bucket, not a
        // rupee budget; the categories page suggests one from real spend later.
        monthlyBudget: null,
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
