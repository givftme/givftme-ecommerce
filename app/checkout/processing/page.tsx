import type { Metadata } from "next";
import { ProcessingScreen } from "@/components/order/ProcessingScreen";
import { NO_INDEX } from "@/lib/seo/metadata";

export const metadata: Metadata = { title: "Checkout", robots: NO_INDEX };

interface ProcessingPageProps {
  searchParams: Promise<{ order?: string | string[] }>;
}

export default async function CheckoutProcessingPage({
  searchParams,
}: ProcessingPageProps) {
  const params = await searchParams;
  const orderId = Array.isArray(params.order) ? params.order[0] : params.order;

  return <ProcessingScreen orderId={orderId} />;
}
