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
  // Reuse-first lookup. Tier 1 is an exact case-insensitive name match over all
  // rows; tier 2 loosens to a normalized key (punctuation, "&"/"and", plurals)
  // over LEAVES ONLY, so a group can never be reached by a loose name. Prefers
  // the user's OWN row over the system template WITHIN a tier (so per-user
  // budgets/renames win), never across one.
  findByNameForUser(userId: string, name: string): Promise<Category | null>;
  findById(id: string): Promise<Category | null>;
  // Returns the existing row instead of throwing if a concurrent write already
  // created this (userId, name).
  create(data: CreateCategoryDTO): Promise<Category>;
  // Clone a shared system row (userId null) into one the user owns, together
  // with its parent group. Idempotent. Returns the row unchanged if it is
  // already user-owned.
  materializeForUser(
    userId: string,
    systemCategoryId: string,
  ): Promise<Category>;
  // Clone selected template groups (+ leaves) into per-user rows. Skips groups
  // the user already has (idempotent re-runs). Returns created leaf count.
  cloneGroupsForUser(
    userId: string,
    groups: CloneGroupInput[],
  ): Promise<number>;
}
