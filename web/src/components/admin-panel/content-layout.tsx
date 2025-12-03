import React from "react";
import { Navbar } from "@/components/admin-panel/navbar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";

interface ContentLayoutProps {
  title: string;
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string; active?: boolean }[];
}

export function ContentLayout({ title, children, breadcrumbs }: ContentLayoutProps) {
  return (
    <div>
      <Navbar title={title} />
      <div className="container pt-8 pb-8 px-4 sm:px-8">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            {breadcrumbs ? (
              breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  <BreadcrumbItem>
                    {item.href ? (
                      <BreadcrumbLink asChild>
                        <Link href={item.href}>{item.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              ))
            ) : (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {title !== "Dashboard" && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{title}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        {children}
      </div>
    </div>
  );
}
