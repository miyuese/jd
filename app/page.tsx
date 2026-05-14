import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "首页"
};

export default function HomePage() {
  return <LandingPage />;
}
