import {
  LayoutGrid,
  LucideIcon,
  ArrowRightLeft,
  PieChart,
  Users,
  Settings,
  Wallet,
  RefreshCw,
  Home,
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
        {
          href: "/dashboard/wallets",
          label: "Wallets",
          icon: Wallet,
        },
        {
          href: "/dashboard/recurring",
          label: "Recurring",
          icon: RefreshCw,
          submenus: [
            { href: "/dashboard/recurring", label: "Charges" },
            { href: "/dashboard/recurring/dues", label: "Upcoming Dues" },
          ],
        },
      ],
    },
    {
      groupLabel: "Management",
      menus: [
        {
          href: "/dashboard/family",
          label: "Family",
          icon: Home,
        },
        {
          href: "/dashboard/vendors",
          label: "Vendors",
          icon: Users,
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
