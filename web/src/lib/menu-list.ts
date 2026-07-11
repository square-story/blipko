import {
  LayoutGrid,
  LucideIcon,
  Receipt,
  PieChart,
  Settings,
  Tag,
  RefreshCw,
  PiggyBank,
} from "lucide-react";

type Submenu = {
  href: string;
  label: string;
  active?: boolean;
};

type Menu = {
  href: string;
  label: string;
  active?: boolean;
  icon: LucideIcon;
  submenus?: Submenu[];
};

type Group = {
  groupLabel: string;
  menus: Menu[];
};

export function getMenuList(): Group[] {
  return [
    {
      groupLabel: "",
      menus: [
        {
          href: "/dashboard",
          label: "Dashboard",
          icon: LayoutGrid,
          submenus: [],
        },
      ],
    },
    {
      groupLabel: "Budget",
      menus: [
        {
          href: "/dashboard/expenses",
          label: "Transactions",
          icon: Receipt,
        },
        {
          href: "/dashboard/analytics",
          label: "Analytics",
          icon: PieChart,
        },
        {
          href: "/dashboard/categories",
          label: "Categories",
          icon: Tag,
        },
        {
          href: "/dashboard/recurring",
          label: "Recurring",
          icon: RefreshCw,
        },
        {
          href: "/dashboard/boxes",
          label: "Boxes",
          icon: PiggyBank,
        },
      ],
    },
    {
      groupLabel: "Settings",
      menus: [
        {
          href: "/dashboard/account",
          label: "Account",
          icon: Settings,
        },
      ],
    },
  ];
}
