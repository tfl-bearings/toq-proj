import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ProfileEditForm from "@/components/ProfileEditForm";
import { getCurrentCustomer } from "@/lib/session";

export default async function EditProfilePage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();

  return (
    <AppShell
      variant="inner"
      title="Change Profile"
      initial={initial}
      back="/profile"
    >
      <p className="mloan-page-lead">Update your details</p>
      <ProfileEditForm
        name={customer.name}
        email={customer.email ?? ""}
        mobile={customer.mobile}
      />
    </AppShell>
  );
}
