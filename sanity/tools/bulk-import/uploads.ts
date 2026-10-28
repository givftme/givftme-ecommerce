import type { SanityClient } from "sanity";
import { isImageAssetId } from "./documents";
import { describeError, isAuthError } from "./errors";
import type { LocalImage } from "./images";

// Uploads local images as Sanity assets, at most three at a time. Each file is
// uploaded once; Sanity also stores identical content as a single asset, so a
// repeated upload returns the existing one instead of a copy. Nothing here
// deletes an asset.

export const UPLOAD_CONCURRENCY = 3;

export type UploadOutcome = { status: "uploaded"; assetId: string } | { status: "failed"; message: string };

export type UploadHalt =
  | { reason: "cancelled" }
  | { reason: "permission"; message: string }
  | { reason: "target"; message: string };

export interface UploadResult {
  outcomes: Map<LocalImage, UploadOutcome>;
  /** Set when uploading stopped early; images not yet started have no outcome. */
  halt: UploadHalt | null;
}

export async function uploadImages(
  client: Pick<SanityClient, "assets">,
  images: readonly LocalImage[],
  {
    concurrency = UPLOAD_CONCURRENCY,
    shouldStop = () => false,
    beforeEach = () => undefined,
    onUploaded,
  }: {
    concurrency?: number;
    shouldStop?: () => boolean;
    /** Runs before each upload starts; throwing stops uploading. Used to recheck the dataset. */
    beforeEach?: () => void;
    onUploaded?: (done: number) => void;
  } = {}
): Promise<UploadResult> {
  const outcomes = new Map<LocalImage, UploadOutcome>();
  let next = 0;
  let halt: UploadHalt | null = null;

  const worker = async () => {
    while (!halt && next < images.length) {
      if (shouldStop()) {
        halt = { reason: "cancelled" };
        return;
      }
      try {
        beforeEach();
      } catch (error) {
        halt = { reason: "target", message: error instanceof Error ? error.message : "The dataset changed." };
        return;
      }

      const image = images[next++];
      try {
        const asset = await client.assets.upload("image", image.blob, { filename: image.filename, contentType: image.type });
        // Only an image asset's ID is ever put in a product.
        outcomes.set(
          image,
          isImageAssetId(asset?._id)
            ? { status: "uploaded", assetId: asset._id }
            : { status: "failed", message: "Sanity answered with something that isn't an image asset." }
        );
      } catch (error) {
        const message = describeError(error);
        outcomes.set(image, { status: "failed", message });
        if (isAuthError(error)) halt ??= { reason: "permission", message };
      }
      onUploaded?.(outcomes.size);
    }
  };

  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), images.length) }, worker));
  return { outcomes, halt };
}
