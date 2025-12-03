import {
  LayoutGrid,
  LucideIcon,
  ArrowRightLeft,
  PieChart,
  Users,
  Tags,
  Settings,
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
      groupLabel: "Finance",
      menus: [
        {
          href: "/dashboard/transactions",
          label: "Transactions",
          icon: ArrowRightLeft,
        },
        {
          href: "/dashboard/analytics",
          label: "Analytics",
          icon: PieChart,
        },
      ],
    },
    {
      groupLabel: "Management",
      menus: [
        {
          href: "/dashboard/vendors",
          label: "Vendors",
          icon: Users,
        },
        {
          href: "/dashboard/categories",
          label: "Categories",
          icon: Tags,
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
