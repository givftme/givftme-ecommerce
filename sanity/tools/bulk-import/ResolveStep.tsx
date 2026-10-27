import { SearchIcon } from "@sanity/icons";
import { Badge, Button, Card, Flex, Stack, Text } from "@sanity/ui";
import { useRef, useState } from "react";
import { useClient } from "sanity";
import { apiVersion } from "@/sanity/env";
import type { ImageMatchResult } from "./matching";
import {
  fetchSanityIndex,
  LookupError,
  resolveImport,
  type ProductResolution,
  type ResolutionOutcome,
  type ResolutionResult,
} from "./resolve";
import type { ImportPlan } from "./types";
import { formatBytes } from "./zip";

// Step 4: one read of the dataset, then every planned product is marked ready,
// warning or blocked. A result belongs to the exact spreadsheet, images and
// dataset it was checked with; when any of them changes it's set aside and
// the editor checks again. Nothing here writes to Sanity.

const PREVIEW_PAGE = 20;

const OUTCOMES: Record<ResolutionOutcome, { label: string; tone: "positive" | "caution" | "critical" }> = {
  blocked: { label: "Blocked", tone: "critical" },
  warning: { label: "Warning", tone: "caution" },
  ready: { label: "Ready", tone: "positive" },
};
const OUTCOME_ORDER: ResolutionOutcome[] = ["blocked", "warning", "ready"];

interface CheckInputs {
  plan: ImportPlan;
  images: ImageMatchResult;
  dataset: string;
  projectId: string;
}

type Check =
  | { status: "loading"; id: number; inputs: CheckInputs }
  | { status: "done"; id: number; inputs: CheckInputs; result: ResolutionResult; checkedAt: Date }
  | { status: "failed"; id: number; inputs: CheckInputs; message: string };

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export function ResolveStep({
  plan,
  images,
  imagesChosen,
  imagesReading,
  workspaceDataset,
}: {
  plan: ImportPlan | null;
  /** Image matching for the plan; matched against no files when none are chosen. */
  images: ImageMatchResult | null;
  imagesChosen: boolean;
  imagesReading: boolean;
  /** The Studio workspace's dataset, which the client must agree with. */
  workspaceDataset: string;
}) {
  const client = useClient({ apiVersion });
  const { dataset = "", projectId = "" } = client.config();
  const request = useRef(0);
  const [check, setCheck] = useState<Check | null>(null);

  const datasetMismatch = dataset !== workspaceDataset;
  // The check, only while it still describes what's on screen.
  const live =
    check &&
    !imagesReading &&
    check.inputs.plan === plan &&
    check.inputs.images === images &&
    check.inputs.dataset === dataset &&
    check.inputs.projectId === projectId
      ? check
      : null;

  const run = async () => {
    if (!plan || !images || imagesReading || datasetMismatch) return;
    // Numbered, so a slow earlier check can't replace a later one.
    const id = ++request.current;
    const inputs: CheckInputs = { plan, images, dataset, projectId };
    setCheck({ status: "loading", id, inputs });
    try {
      const index = await fetchSanityIndex(client);
      const result = resolveImport(inputs.plan, inputs.images, index);
      if (id === request.current) setCheck({ status: "done", id, inputs, result, checkedAt: new Date() });
    } catch (error) {
      if (id !== request.current) return;
      if (!(error instanceof LookupError)) {
        console.error("Bulk import: couldn't check the spreadsheet against the Studio", error);
      }
      setCheck({
        status: "failed",
        id,
        inputs,
        message: error instanceof LookupError ? error.message : "Something went wrong while checking. Try again.",
      });
    }
  };

  if (!plan) {
    return (
      <Text size={1} muted>
        Choose a spreadsheet first.
      </Text>
    );
  }
  if (!plan.products.length) {
    return (
      <Text size={1} muted>
        No products passed spreadsheet validation, so there&apos;s nothing to check.
      </Text>
    );
  }

  const loading = live?.status === "loading";

  return (
    <Stack space={4}>
      <Stack space={3}>
        <Flex align="center" gap={2} wrap="wrap">
          <Button
            icon={SearchIcon}
            mode="ghost"
            text="Check against the Studio"
            loading={loading}
            disabled={loading || imagesReading || datasetMismatch}
            onClick={() => void run()}
          />
          <Badge tone={dataset === "production" ? "caution" : "primary"}>Reads dataset: {dataset || "unknown"}</Badge>
        </Flex>
        <Text size={1} muted>
          This only reads from the Studio. Nothing has been uploaded or saved: no products are created and no images
          are uploaded in this step.
        </Text>
        {!imagesChosen && (
          <Text size={1} muted>
            No images are chosen. Products that list images in the spreadsheet will be blocked; products that need none
            can still be checked.
          </Text>
        )}
      </Stack>

      {datasetMismatch && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>
            The Studio client reads &quot;{dataset || "unknown"}&quot;, but this workspace is &quot;{workspaceDataset}
            &quot;. Reload the Studio before checking.
          </Text>
        </Card>
      )}

      {imagesReading && (
        <Text size={1} muted>
          Waiting for the chosen images to finish reading.
        </Text>
      )}

      {check && !live && !imagesReading && (
        <Card padding={3} radius={2} tone="caution">
          <Text size={1}>
            The spreadsheet, images or dataset changed since the last check, so its results no longer apply. Check
            again.
          </Text>
        </Card>
      )}

      {live?.status === "loading" && (
        <Text size={1} muted>
          Checking {plural(plan.products.length, "product")} against {dataset}…
        </Text>
      )}

      {live?.status === "failed" && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>{live.message}</Text>
        </Card>
      )}

      {live?.status === "done" && (
        <ResolutionView key={live.id} result={live.result} dataset={live.inputs.dataset} checkedAt={live.checkedAt} />
      )}
    </Stack>
  );
}

function ResolutionView({ result, dataset, checkedAt }: { result: ResolutionResult; dataset: string; checkedAt: Date }) {
  const [shown, setShown] = useState(PREVIEW_PAGE);
  const { summary } = result;
  const importable = summary.ready + summary.warning;
  const products = [...result.products].sort(
    (a, b) => OUTCOME_ORDER.indexOf(a.outcome) - OUTCOME_ORDER.indexOf(b.outcome)
  );
  const blockedBy = [
    summary.alreadyImported && `${summary.alreadyImported} already in the Studio`,
    summary.duplicates && `${summary.duplicates} with a slug or SKU already in use`,
    summary.missingImages && `${summary.missingImages} missing images`,
    summary.missingReferences && `${summary.missingReferences} with a missing or unusable collection or supplier`,
  ].filter(Boolean);

  return (
    <Stack space={3}>
      <Card
        padding={3}
        radius={2}
        tone={!importable ? "critical" : summary.blocked || summary.warning ? "caution" : "positive"}
      >
        <Stack space={2}>
          <Text size={1} weight="semibold">
            {importable === summary.checked && !summary.warning
              ? "Every product is ready to import"
              : `${importable} of ${plural(summary.checked, "product")} can be imported`}
          </Text>
          <Text size={1}>
            {summary.ready} ready · {summary.warning} with warnings · {summary.blocked} blocked
            {blockedBy.length > 0 && ` (${blockedBy.join(", ")})`}
          </Text>
          {summary.rejectedInSpreadsheet > 0 && (
            <Text size={1}>
              {plural(summary.rejectedInSpreadsheet, "more product")} failed spreadsheet validation and{" "}
              {summary.rejectedInSpreadsheet === 1 ? "isn't" : "aren't"} included.
            </Text>
          )}
          <Text size={1}>
            The importable products use {plural(summary.uploadImages, "image file")} ({formatBytes(summary.uploadBytes)})
            {summary.sharedImages > 0 && `; ${plural(summary.sharedImages, "is", "are")} shared by several products and counted once`}
            . {summary.activeIfPublished} {summary.activeIfPublished === 1 ? "is" : "are"} marked active and would show on
            the storefront if published.
          </Text>
          <Text size={1} muted>
            Checked against {dataset} at {checkedAt.toLocaleTimeString()}. This is a snapshot: changes made in the Studio
            after it aren&apos;t reflected, so check again just before importing.
          </Text>
        </Stack>
      </Card>

      <Stack space={2}>
        {products.slice(0, shown).map((product) => (
          <ProductResult key={product.documentId} product={product} />
        ))}
      </Stack>
      {products.length > shown && (
        <Flex>
          <Button
            mode="ghost"
            text={`Show more (${products.length - shown} left)`}
            onClick={() => setShown((count) => count + PREVIEW_PAGE)}
          />
        </Flex>
      )}
    </Stack>
  );
}

function ProductResult({ product }: { product: ProductResolution }) {
  const outcome = OUTCOMES[product.outcome];
  const blocked = product.outcome === "blocked";

  return (
    <Card padding={3} radius={2} border tone={blocked ? "critical" : "default"} data-outcome={product.outcome}>
      <Stack space={3}>
        <Flex align="center" gap={2} wrap="wrap">
          <Text size={1} weight="semibold">
            {product.title}
          </Text>
          <Text size={1} muted>
            {product.handle}
          </Text>
          <Badge tone={outcome.tone} fontSize={0}>
            {outcome.label}
          </Badge>
        </Flex>
        <Text size={1} muted>
          {product.rows.length === 1 ? "Row" : "Rows"} {product.rows.join(", ")} · {product.documentId} · status{" "}
          {product.status}
        </Text>

        {(product.skipReasons.length > 0 || product.warnings.length > 0) && (
          <Stack as="ul" space={2} style={{ margin: 0, paddingLeft: "1.25em" }}>
            {product.skipReasons.map((entry, index) => (
              <Text as="li" key={`skip-${index}`} size={1}>
                {entry.message}
              </Text>
            ))}
            {product.warnings.map((warning, index) => (
              <Text as="li" key={`warning-${index}`} size={1}>
                {warning}
              </Text>
            ))}
          </Stack>
        )}

        {!blocked && (
          <Stack as="dl" space={2} style={{ margin: 0 }}>
            <Detail label="Collections">
              {product.collections.length
                ? product.collections.map((collection) => `${collection.title} (${collection.id})`).join(", ")
                : "None"}
            </Detail>
            <Detail label="Supplier">
              {product.supplier ? `${product.supplier.name} (${product.supplier.id})` : "None"}
            </Detail>
            <Detail label="Images">{product.images.length ? product.images.join(", ") : "None"}</Detail>
            {product.variantImages.length > 0 && (
              <Detail label="Variant images">
                {product.variantImages.map((entry) => `${entry.combinationKey} → ${entry.filename}`).join(", ")}
              </Detail>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: string }) {
  return (
    <Flex gap={2} wrap="wrap">
      <Text as="dt" size={1} muted>
        {label}:
      </Text>
      <Text as="dd" size={1} style={{ margin: 0 }}>
        {children}
      </Text>
    </Flex>
  );
}
