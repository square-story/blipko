import { Bucket, Category } from "@prisma/client";

export interface CreateCategoryDTO {
  userId: string;
  name: string;
  bucket: Bucket;
}

export interface ICategoryRepository {
  // System categories (userId null) plus the user's custom categories.
  findAllForUser(userId: string): Promise<Category[]>;
  // Case-insensitive match across system + user categories.
  findByNameForUser(userId: string, name: string): Promise<Category | null>;
  create(data: CreateCategoryDTO): Promise<Category>;
}
