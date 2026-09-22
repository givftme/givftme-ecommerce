import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "@/sanity/env";
import { requireEnv } from "@/lib/env";

export function createSanityWriteClient() {
  return createClient({
    projectId,
    dataset,
    apiVersion,
    token: requireEnv(process.env.SANITY_WRITE_TOKEN, "SANITY_WRITE_TOKEN"),
    useCdn: false,
  });
}
