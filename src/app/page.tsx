import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/session";

export default async function Root() {
  const customer = await getCurrentCustomer();
  redirect(customer ? "/home" : "/login");
}
