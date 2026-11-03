import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { UploadProvider } from "@/features/dashboard/upload-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <UploadProvider>
      <AppShell>{children}</AppShell>
    </UploadProvider>
  );
}
