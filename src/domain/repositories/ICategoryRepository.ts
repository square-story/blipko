import { Bucket, Category } from "@prisma/client";

export interface CreateCategoryDTO {
  userId: string;
  name: string;
  bucket: Bucket;
  isGroup?: boolean | undefined;
  parentId?: string | undefined;
  monthlyBudget?: number | undefined;
}

// One group to clone for a user, with its leaves + suggested per-leaf budgets.
export interface CloneGroupInput {
  name: string;
  bucket: Bucket;
  children: Array<{
    name: string;
    bucket: Bucket;
    monthlyBudget?: number | undefined;
  }>;
}

export interface ICategoryRepository {
  // System categories (userId null) plus the user's custom categories.
  findAllForUser(userId: string): Promise<Category[]>;
  // Case-insensitive match. Prefers the user's OWN row over the system template
  // when both exist (so per-user budgets/renames win).
  findByNameForUser(userId: string, name: string): Promise<Category | null>;
  findById(id: string): Promise<Category | null>;
  create(data: CreateCategoryDTO): Promise<Category>;
  // Clone selected template groups (+ leaves) into per-user rows. Skips groups
  // the user already has (idempotent re-runs). Returns created leaf count.
  cloneGroupsForUser(
    userId: string,
    groups: CloneGroupInput[],
  ): Promise<number>;
}
