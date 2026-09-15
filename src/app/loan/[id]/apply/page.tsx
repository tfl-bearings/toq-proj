import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ApplyForm from "@/components/ApplyForm";
import { getCurrentCustomer } from "@/lib/session";
import { getProduct } from "@/lib/db";
import { inr } from "@/lib/format";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();

  return (
    <AppShell
      variant="inner"
      title={`Apply · ${product.name}`}
      initial={initial}
      back={`/loan/${product.id}`}
    >
      <section className="mloan-info-card">
        <div className="mloan-product-card">
          <div className="mloan-product-icon" aria-hidden>
            {product.icon}
          </div>
          <div className="mloan-product-body">
            <h3>{product.name}</h3>
            <div className="mloan-amount-range">
              {inr(product.min)} – {inr(product.max)}
            </div>
            <div className="mloan-muted">
              {product.rateMonthly}% / month · up to {product.tenureMonths}{" "}
              months
            </div>
          </div>
        </div>
      </section>

      <p className="mloan-page-lead">Tell us what you need</p>
      <ApplyForm product={product} />

      <p className="mloan-tiny-note">
        Submitting an application does not guarantee approval. Our team reviews
        each request. You&apos;ll never be asked to pay a fee to receive a loan.
      </p>
    </AppShell>
  );
}
