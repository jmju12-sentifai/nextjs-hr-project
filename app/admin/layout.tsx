import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import AdminHeader from "./AdminHeader";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer.email) redirect("/login?next=/admin/applist");
  if (!viewer.isAdmin) redirect("/?denied=admin");
  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader email={viewer.email} />
      {children}
    </div>
  );
}
