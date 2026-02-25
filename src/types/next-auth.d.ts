import { UserRole } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      orgId: string | null;
      hazmatAccess: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    organizationId: string | null;
    hazmatAccess: boolean;
    password?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    orgId: string | null;
    hazmatAccess: boolean;
  }
}
