import type { Metadata } from "next";
import { AboutPage } from "@/components/about/about-page";

export const metadata: Metadata = {
  title: "Acerca de | Arcade Vault",
  description:
    "Conoce la misión de Arcade Vault y escríbenos tus sugerencias o propuestas de juegos.",
};

export default function AcercaPage() {
  return <AboutPage />;
}
