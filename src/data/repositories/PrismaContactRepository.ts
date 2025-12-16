import { PrismaClient, Contact } from "@prisma/client";
import {
  IContactRepository,
  CreateContactDTO,
} from "../../domain/repositories/IContactRepository";

export class PrismaContactRepository implements IContactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateContactDTO): Promise<Contact> {
    return this.prisma.contact.create({
      data: {
        userId: data.userId,
        name: data.name,
      },
    });
  }

  async findByName(userId: string, name: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
    });
  }

  async findSimilarByName(
    userId: string,
    name: string,
    threshold: number = 2,
  ): Promise<Contact | null> {
    // 1. Try exact match (case-insensitive) first using database
    // Prisma's default collation might be case-insensitive depending on DB,
    // but let's do a quick explicit check or rely on collation.
    // For consistent behavior, we'll fetch all names and check in-memory for small sets.
    // Assuming contact list per user is small (<1000).

    const contacts = await this.findAllByUser(userId);
    const targetName = name.trim().toLowerCase();

    let bestMatch: Contact | null = null;
    let minDistance = Infinity;

    for (const contact of contacts) {
      const contactName = contact.name.trim().toLowerCase();

      // Exact match ignore case
      if (contactName === targetName) {
        return contact;
      }

      const distance = this.levenshtein(targetName, contactName);
      if (distance <= threshold && distance < minDistance) {
        minDistance = distance;
        bestMatch = contact;
      }
    }

    return bestMatch;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    // Create matrix[m+1][n+1]
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      new Array(n + 1).fill(0),
    );

    for (let i = 0; i <= m; i++) {
      dp[i]![0] = i;
    }

    for (let j = 0; j <= n; j++) {
      dp[0]![j] = j;
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i]![j] = Math.min(
          dp[i - 1]![j]! + 1, // deletion
          dp[i]![j - 1]! + 1, // insertion
          dp[i - 1]![j - 1]! + cost, // substitution
        );
      }
    }

    return dp[m]![n]!;
  }

  async findById(id: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({
      where: { id },
    });
  }

  async findAllByUser(userId: string): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: { userId },
    });
  }
}
