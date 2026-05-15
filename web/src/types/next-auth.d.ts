import type { DefaultSession } from "next-auth";
import type {} from "next-auth/adapters";
import type {} from "@auth/core/adapters";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isEarlyAdopter: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    isEarlyAdopter?: boolean;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    isEarlyAdopter?: boolean;
  }
}
