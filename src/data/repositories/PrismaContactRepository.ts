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

  private normalizeName(name: string): string {
    // 1. Lowercase and trim
    let normalized = name.toLowerCase().trim();

    // 2. Remove special characters (keep alphanumeric and spaces)
    normalized = normalized.replace(/[^a-z0-9\s]/g, "");

    // 3. Remove common Indian honorifics and generic titles
    // Add more as needed. Note: order matters for substrings.
    const honorifics = [
      "bhai",
      "ji",
      "sir",
      "mem",
      "mam",
      "madam",
      "bro",
      "brother",
      "sister",
      "didi",
      "uncle",
      "aunty",
      "dr",
      "mr",
      "mrs",
      "er",
    ];

    // Remove honorifics if they are at the end or start as distinct words
    for (const title of honorifics) {
      // End of string
      if (normalized.endsWith(" " + title)) {
        normalized = normalized.slice(0, -(title.length + 1)).trim();
      }
      // Start of string
      if (normalized.startsWith(title + " ")) {
        normalized = normalized.substring(title.length + 1).trim();
      }
    }

    return normalized;
  }

  async findSimilarByName(
    userId: string,
    name: string,
    // Threshold is now dynamic, but we keep the signature compatible or optional
    _threshold: number = 2,
  ): Promise<Contact | null> {
    const contacts = await this.findAllByUser(userId);
    const inputNameOrig = name.trim();
    const inputNameNorm = this.normalizeName(inputNameOrig);

    // If input is empty after normalization, fallback to original
    const targetName = inputNameNorm || inputNameOrig.toLowerCase();

    let bestMatch: Contact | null = null;
    let minDistance = Infinity;

    for (const contact of contacts) {
      const contactNameOrig = contact.name.trim();
      const contactNameNorm = this.normalizeName(contactNameOrig);
      const currentName = contactNameNorm || contactNameOrig.toLowerCase();

      // Strategy 1: Exact Match (Normalized)
      if (currentName === targetName) {
        return contact;
      }

      // Strategy 2: Containment (Token Match) & StartsWith
      // Check if one is a distinct word in the other
      // e.g. "Raju" in "Raju Kumar"
      // Ensure we don't match short substrings like "Al" in "Ali" inappropriately
      if (currentName.length > 2 && targetName.length > 2) {
        const regexCurrent = new RegExp(`\\b${currentName}\\b`);
        const regexTarget = new RegExp(`\\b${targetName}\\b`);

        if (regexCurrent.test(targetName) || regexTarget.test(currentName)) {
          // Create a preference for the shorter name being the existing one?
          // Actually, if "Raju" exists and input is "Raju Kumar", we match "Raju".
          // If "Raju Kumar" exists and input is "Raju", we match "Raju Kumar".
          return contact;
        }

        // Simple includes check for now if regex allows partials too easily?
        // Let's stick to word boundary regex above.
      }

      // Strategy 3: Improved Levenshtein
      // Dynamic threshold: Allow 1 edit for every 4 characters, min 1, max 3.
      const longerLength = Math.max(currentName.length, targetName.length);
      const dynamicThreshold = Math.max(
        1,
        Math.min(3, Math.floor(longerLength / 4)),
      );

      const distance = this.levenshtein(targetName, currentName);

      if (distance <= dynamicThreshold && distance < minDistance) {
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
