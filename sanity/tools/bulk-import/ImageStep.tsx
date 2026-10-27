import { CloseIcon, FolderIcon, ImagesIcon } from "@sanity/icons";
import { Badge, Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { buildImageLibrary, MAX_IMAGE_BYTES, type ImageLibrary } from "./images";
import { IssueList, issueLocation } from "./IssueList";
import type { ImageMatchResult, ImageSlot, ProductImageMatch } from "./matching";
import type { ImportPlan } from "./types";
import { formatBytes, ZIP_LIMITS } from "./zip";

// Step 3: pick images (files, a folder or ZIPs), then see which product each
// one went to. Everything here stays in the browser.

const PREVIEW_PAGE = 20;
const ACCEPT = ".jpg,.jpeg,.png,.webp,.zip,image/jpeg,image/png,image/webp,application/zip";

const SLOT_LABELS: Record<ImageSlot["status"], string> = {
  matched: "Matched",
  missing: "Missing",
  conflict: "Ambiguous",
  rejected: "Can't use",
};

/** Same file chosen twice (by any button) is only read once. */
const fileIdentity = (file: File) => `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;

export function ImageStep({
  plan,
  library,
  match,
  onLibraryChange,
}: {
  plan: ImportPlan | null;
  library: ImageLibrary | null;
  /** Matching for the current plan; computed by the parent so later steps share it. */
  match: ImageMatchResult | null;
  onLibraryChange: (library: ImageLibrary | null) => void;
}) {
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const [files, setFiles] = useState<File[]>([]);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [shownProducts, setShownProducts] = useState(PREVIEW_PAGE);
  const setLibrary = onLibraryChange;

  // A new spreadsheet starts its previews from the first page again.
  const [pagedPlan, setPagedPlan] = useState(plan);
  if (pagedPlan !== plan) {
    setPagedPlan(plan);
    setShownProducts(PREVIEW_PAGE);
  }

  const load = async (next: File[]) => {
    const id = ++request.current;
    setFiles(next);
    setReading(true);
    setReadError(null);
    try {
      const built = await buildImageLibrary(next);
      if (id === request.current) setLibrary(built);
    } catch (error) {
      console.error("Bulk import: couldn't read the chosen images", error);
      if (id === request.current) {
        setLibrary(null);
        setReadError("Couldn't read those files. Try choosing them again.");
      }
    } finally {
      if (id === request.current) setReading(false);
    }
  };

  const add = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!picked.length) return;
    const seen = new Set(files.map(fileIdentity));
    void load([...files, ...picked.filter((file) => !seen.has(fileIdentity(file)))]);
  };

  const clear = () => {
    request.current += 1;
    setFiles([]);
    setLibrary(null);
    setReading(false);
    setReadError(null);
    setShownProducts(PREVIEW_PAGE);
  };

  if (!plan) {
    // Chosen images are kept for the next spreadsheet, so they can still be cleared here.
    return (
      <Stack space={3}>
        <Text size={1} muted>
          Choose a spreadsheet first, so images can be matched to its products.
        </Text>
        {files.length > 0 && (
          <Flex align="center" gap={2} wrap="wrap">
            <Text size={1} muted>
              {files.length} file{files.length === 1 ? " is" : "s are"} still chosen and will be matched to the next
              spreadsheet.
            </Text>
            <Button icon={CloseIcon} mode="bleed" text="Clear images" disabled={reading} onClick={clear} />
          </Flex>
        )}
      </Stack>
    );
  }

  // Products that need attention first, then the rest in spreadsheet order.
  const products = match ? [...match.products].sort((a, b) => Number(a.ok) - Number(b.ok)) : [];
  const noProducts = match?.summary.products === 0;

  return (
    <Stack space={4}>
      <Stack space={3}>
        <Flex align="center" gap={2} wrap="wrap">
          <Button
            icon={ImagesIcon}
            mode="ghost"
            text="Add images or ZIP"
            disabled={reading}
            onClick={() => filesInput.current?.click()}
          />
          <Button
            icon={FolderIcon}
            mode="ghost"
            text="Add a folder"
            disabled={reading}
            onClick={() => folderInput.current?.click()}
          />
          {files.length > 0 && (
            <Button icon={CloseIcon} mode="bleed" text="Clear images" disabled={reading} onClick={clear} />
          )}
          <input ref={filesInput} type="file" multiple hidden accept={ACCEPT} onChange={add} />
          <input ref={folderInput} type="file" multiple hidden onChange={add} {...{ webkitdirectory: "" }} />
        </Flex>
        <Text size={1} muted>
          JPG, PNG or WebP up to {formatBytes(MAX_IMAGE_BYTES)} each; ZIPs up to {formatBytes(ZIP_LIMITS.archiveBytes)}.
          Name files as the spreadsheet lists them, or after the product&apos;s SKU (nk001.jpg, nk001-2.jpg …). Files
          stay on this device; nothing is uploaded yet.
        </Text>
      </Stack>

      {reading && (
        <Text size={1} muted>
          Reading {files.length} file{files.length === 1 ? "" : "s"}…
        </Text>
      )}
      {readError && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>{readError}</Text>
        </Card>
      )}

      {library && !reading && (
        <IssueList
          items={library.issues.map((issue) => ({ severity: issue.severity, location: issue.source, message: issue.message }))}
        />
      )}

      {match && library && !reading && (
        <Stack space={3}>
          <Card
            padding={3}
            radius={2}
            tone={noProducts ? "caution" : match.summary.productsBlocked ? "critical" : "positive"}
          >
            <Stack space={2}>
              <Text size={1} weight="semibold">
                {noProducts
                  ? "No products passed spreadsheet validation, so there's nothing to match images to yet"
                  : match.summary.productsBlocked
                    ? `${match.summary.productsBlocked} product${match.summary.productsBlocked === 1 ? " needs" : "s need"} image fixes`
                    : "Every listed image was found"}
              </Text>
              <Text size={1}>
                {library.stats.images} usable image{library.stats.images === 1 ? "" : "s"} from {library.stats.files} file
                {library.stats.files === 1 ? "" : "s"} · {match.summary.matched} matched ({match.summary.matchedBySku} by
                SKU or handle) · {match.summary.unmatched} not found · {match.summary.unused} unused ·{" "}
                {match.summary.productsWithoutImages} product{match.summary.productsWithoutImages === 1 ? "" : "s"} without
                images
              </Text>
            </Stack>
          </Card>

          <IssueList
            items={match.issues.map((issue) => ({
              severity: issue.severity,
              location: issueLocation(issue, "Images"),
              message: issue.message,
            }))}
          />

          <Stack space={2}>
            {products.slice(0, shownProducts).map((product) => (
              <ProductPreview key={product.documentId} product={product} />
            ))}
          </Stack>
          {products.length > shownProducts && (
            <Flex>
              <Button
                mode="ghost"
                text={`Show more (${products.length - shownProducts} left)`}
                onClick={() => setShownProducts((count) => count + PREVIEW_PAGE)}
              />
            </Flex>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function ProductPreview({ product }: { product: ProductImageMatch }) {
  return (
    <Card padding={3} radius={2} border tone={product.ok ? "default" : "critical"}>
      <Stack space={3}>
        <Flex align="center" gap={2} wrap="wrap">
          <Text size={1} weight="semibold">
            {product.title}
          </Text>
          <Text size={1} muted>
            {product.handle}
          </Text>
          {product.fallbackId && product.gallery.length > 0 && (
            <Badge fontSize={0}>Found by {product.fallbackId}</Badge>
          )}
          {!product.ok && (
            <Badge tone="critical" fontSize={0}>
              Needs images
            </Badge>
          )}
        </Flex>

        {product.gallery.length ? (
          <Flex gap={2} wrap="wrap">
            {product.gallery.map((slot, index) => (
              <Thumbnail key={slot._key} slot={slot} caption={index === 0 ? `Card · ${slot.filename}` : slot.filename} />
            ))}
          </Flex>
        ) : (
          <Text size={1} muted>
            No gallery images.
          </Text>
        )}

        {product.variantImages.length > 0 && (
          <Stack space={2}>
            <Text size={1} muted>
              Variant images
            </Text>
            <Flex gap={2} wrap="wrap">
              {product.variantImages.map((slot) => (
                <Thumbnail key={slot.combinationKey} slot={slot} caption={slot.combinationKey} />
              ))}
            </Flex>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

function Thumbnail({ slot, caption }: { slot: ImageSlot; caption: string }) {
  return (
    <Stack space={1} style={{ width: 88 }}>
      <Card
        radius={2}
        border
        tone={slot.image ? "default" : "critical"}
        style={{ width: 88, height: 88, overflow: "hidden" }}
        title={slot.reason ?? slot.image?.source ?? slot.filename}
      >
        {slot.image ? (
          <BlobImage blob={slot.image.blob} alt={slot.filename} />
        ) : (
          <Flex height="fill" align="center" justify="center" padding={1}>
            <Text size={0} align="center">
              {SLOT_LABELS[slot.status]}
            </Text>
          </Flex>
        )}
      </Card>
      <Text size={0} muted textOverflow="ellipsis" title={caption}>
        {caption}
      </Text>
    </Stack>
  );
}

function BlobImage({ blob, alt }: { blob: Blob; alt: string }) {
  // The object URL lives exactly as long as the element, so previews never leak.
  const attach = useCallback(
    (element: HTMLImageElement | null) => {
      if (!element) return;
      const url = URL.createObjectURL(blob);
      element.src = url;
      return () => URL.revokeObjectURL(url);
    },
    [blob]
  );

  return (
    // eslint-disable-next-line @next/next/no-img-element -- a local blob preview; next/image can't optimise it
    <img
      ref={attach}
      alt={alt}
      decoding="async"
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
  );
}
