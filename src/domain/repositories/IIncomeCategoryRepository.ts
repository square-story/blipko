import { IncomeCategory } from "@prisma/client";

export interface IIncomeCategoryRepository {
  // System categories (userId = null) plus any the user owns. Used both to
  // prompt the parser and to resolve the name it picks back to a row.
  findAllForUser(userId: string): Promise<IncomeCategory[]>;
}
