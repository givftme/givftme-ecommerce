import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Star } from "lucide-react";
import { AdminPageHeader, DataTable, EmptyState, fieldLabel, Panel, selectClass, smallInput, td, th } from "@/components/admin/AdminUi";
import { ReviewDeleteButton } from "@/components/admin/ModerationActions";
import { Button } from "@/components/ui/Button";
import { requireAdminScreen } from "@/lib/admin/auth";
import { listAdminReviews, studioProductUrl } from "@/lib/admin/data/moderation";
import { formatAdminDate } from "@/lib/admin/format";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reviews" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReviewsAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const rating = Number.parseInt(params.rating || "", 10);
  const filters = {
    rating: rating >= 1 && rating <= 5 ? rating : null,
    product: params.product?.trim() || null,
    from: DATE.test(params.from || "") ? params.from! : null,
    to: DATE.test(params.to || "") ? params.to! : null,
  };
  await requireAdminScreen("reviews", { path: "/admin/reviews" });
  const { reviews, products } = await listAdminReviews(createServiceClient(), filters);

  return (
    <>
      <AdminPageHeader title="Reviews" description="Verified-purchase reviews, newest first. Deleting one removes it from the product page." />
      <Panel className="mb-6">
        <form action="/admin/reviews" className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div>
            <label htmlFor="rating" className={fieldLabel}>Rating</label>
            <select id="rating" name="rating" defaultValue={filters.rating ?? ""} className={selectClass}>
              <option value="">Any</option>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}★</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="product" className={fieldLabel}>Product</label>
            <select id="product" name="product" defaultValue={filters.product ?? ""} className={selectClass}>
              <option value="">All products</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="from" className={fieldLabel}>From</label>
            <input id="from" name="from" type="date" defaultValue={filters.from ?? ""} className={smallInput} />
          </div>
          <div>
            <label htmlFor="to" className={fieldLabel}>To</label>
            <input id="to" name="to" type="date" defaultValue={filters.to ?? ""} className={smallInput} />
          </div>
          <div className="col-span-2 flex items-end gap-2 md:col-span-1">
            <Button type="submit" size="sm" className="h-10 flex-1">Filter</Button>
            <Link href="/admin/reviews" className="inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-brand hover:bg-brand-light">Reset</Link>
          </div>
        </form>
      </Panel>
      <Panel>
        {reviews.length === 0 ? <EmptyState title="No reviews match." /> : (
          <DataTable>
            <thead>
              <tr>
                <th className={th}>Reviewer</th>
                <th className={th}>Product</th>
                <th className={th}>Rating</th>
                <th className={th}>Review</th>
                <th className={th}>Date</th>
                <th className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td className={td}>{review.reviewer_name ?? "—"}</td>
                  <td className={td}>{review.product_title ?? <span className="text-muted">{review.catalog_product_id}</span>}</td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-1 tabular-nums" aria-label={`${review.rating} out of 5`}>
                      {review.rating}<Star aria-hidden="true" className="h-3.5 w-3.5 fill-current text-amber" />
                    </span>
                  </td>
                  <td className={td}><p className="line-clamp-2 max-w-sm text-sm">{review.body || <span className="text-muted">No written review</span>}</p></td>
                  <td className={td}>{formatAdminDate(review.created_at)}</td>
                  <td className={td}>
                    <div className="flex flex-wrap justify-end gap-1">
                      <a href={studioProductUrl(review.catalog_product_id)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-brand hover:bg-brand-light">
                        View product <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      </a>
                      <ReviewDeleteButton reviewId={review.id} summary={`${review.rating}★ from ${review.reviewer_name ?? "a customer"} on ${review.product_title ?? "this product"}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>
    </>
  );
}
