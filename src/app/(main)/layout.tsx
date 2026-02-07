import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import Header from "@/components/header";
import AppShell from "@/components/AppShell"; // Assuming this is your wrapper

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // We wrap ONLY the main app pages in the Sidebar/AppShell
    <AppShell>{children}</AppShell>
  );
}