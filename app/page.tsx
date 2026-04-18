import type { Metadata } from "next";

import MmiExperience from "@/mmi/components/MmiExperience";

export const metadata: Metadata = {
  title: "MMI International References",
  description: "Interactive world map of M Mérnöki Iroda Kft. references.",
  manifest: "/mmi-data/mmi-app.webmanifest",
};

export default function HomePage() {
  return <MmiExperience />;
}
