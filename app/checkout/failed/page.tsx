import { PaymentFailedScreen } from "@/components/order/PaymentFailedScreen";

interface FailedPageProps {
  searchParams: Promise<{
    order?: string | string[];
    reason?: string | string[];
  }>;
}

export default async function CheckoutFailedPage({ searchParams }: FailedPageProps) {
  const params = await searchParams;
  const orderId = Array.isArray(params.order) ? params.order[0] : params.order;
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;

  return <PaymentFailedScreen orderId={orderId} reason={reason} />;
}
