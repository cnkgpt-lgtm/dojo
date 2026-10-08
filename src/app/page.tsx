import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function RootPage() {
  const sesi = await auth();
  redirect(sesi?.user ? "/dashboard" : "/login");
}
