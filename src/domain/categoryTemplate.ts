import { Bucket } from "@prisma/client";

// The system category taxonomy: 7 parent groups → leaf categories. Shared by the
// seed (system template, userId=null), the onboarding clone (per-user copies),
// and the budget-suggestion engine. `weight` is the leaf's relative share WITHIN
// its bucket; the suggester normalizes weights across the leaves a user actually
// selects, so the per-leaf budgets always sum to the bucket budget.

export interface LeafTemplate {
  name: string;
  bucket: Bucket;
  weight: number;
}

export interface GroupTemplate {
  key: string; // short, callback-safe id (e.g. "ess")
  name: string;
  bucket: Bucket; // display/default bucket for the group
  defaultSelected: boolean; // pre-checked in the onboarding wizard
  children: LeafTemplate[];
}

export const CATEGORY_TEMPLATE: GroupTemplate[] = [
  {
    key: "ess",
    name: "Essentials",
    bucket: "NEEDS",
    defaultSelected: true,
    children: [
      { name: "Rent", bucket: "NEEDS", weight: 45 },
      { name: "Utilities", bucket: "NEEDS", weight: 12 },
      { name: "Phone Bill", bucket: "NEEDS", weight: 5 },
      { name: "Internet", bucket: "NEEDS", weight: 6 },
      { name: "Insurance", bucket: "NEEDS", weight: 8 },
    ],
  },
  {
    key: "food",
    name: "Food & Drinks",
    bucket: "WANTS",
    defaultSelected: true,
    children: [
      { name: "Groceries", bucket: "NEEDS", weight: 25 },
      { name: "Eating Out", bucket: "WANTS", weight: 18 },
      { name: "Coffee & Tea", bucket: "WANTS", weight: 6 },
      { name: "Food Delivery", bucket: "WANTS", weight: 10 },
    ],
  },
  {
    key: "trans",
    name: "Transportation",
    bucket: "NEEDS",
    defaultSelected: true,
    children: [
      { name: "Fuel", bucket: "NEEDS", weight: 12 },
      { name: "Public Transport", bucket: "NEEDS", weight: 6 },
      { name: "Cab & Auto", bucket: "WANTS", weight: 6 },
      { name: "Vehicle Upkeep", bucket: "NEEDS", weight: 6 },
    ],
  },
  {
    key: "ent",
    name: "Entertainment & Leisure",
    bucket: "WANTS",
    defaultSelected: false,
    children: [
      { name: "Subscriptions", bucket: "WANTS", weight: 8 },
      { name: "Movies & Events", bucket: "WANTS", weight: 8 },
      { name: "Hobbies", bucket: "WANTS", weight: 8 },
      { name: "Travel", bucket: "WANTS", weight: 12 },
    ],
  },
  {
    key: "health",
    name: "Health & Wellness",
    bucket: "NEEDS",
    defaultSelected: true,
    children: [
      { name: "Medical", bucket: "NEEDS", weight: 8 },
      { name: "Pharmacy", bucket: "NEEDS", weight: 5 },
      { name: "Fitness", bucket: "WANTS", weight: 6 },
      { name: "Personal Care", bucket: "WANTS", weight: 6 },
    ],
  },
  {
    key: "misc",
    name: "Miscellaneous",
    bucket: "WANTS",
    defaultSelected: false,
    children: [
      { name: "Shopping", bucket: "WANTS", weight: 12 },
      { name: "Gifts", bucket: "WANTS", weight: 5 },
      { name: "Other", bucket: "WANTS", weight: 5 },
    ],
  },
  {
    key: "save",
    name: "Savings",
    bucket: "SAVINGS",
    defaultSelected: true,
    children: [
      { name: "Emergency Fund", bucket: "SAVINGS", weight: 35 },
      { name: "Investments", bucket: "SAVINGS", weight: 40 },
      { name: "Goals", bucket: "SAVINGS", weight: 15 },
      { name: "Debt Prepayment", bucket: "SAVINGS", weight: 10 },
    ],
  },
];

export function groupByKey(key: string): GroupTemplate | undefined {
  return CATEGORY_TEMPLATE.find((g) => g.key === key);
}
