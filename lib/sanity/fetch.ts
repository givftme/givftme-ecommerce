import { client } from "@/sanity/lib/client";

export async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {},
  revalidate = 60
) {
  return client.fetch<T>(query, params, {
    next: { revalidate },
  });
}
