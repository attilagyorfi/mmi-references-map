import type { Metadata } from "next";

import MmiAdmin from "@/mmi/components/admin/MmiAdmin";

export const metadata: Metadata = {
  title: "MMI References Admin",
};

export default function MmiAdminPage() {
  return <MmiAdmin />;
}
