import { CloseIcon, DocumentSheetIcon, DownloadIcon } from "@sanity/icons";
import { Badge, Box, Button, Card, Container, Flex, Heading, Stack, Text } from "@sanity/ui";
import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useCurrentUser, useDataset } from "sanity";
import { getImportAccess, type ImportAccess } from "./access";
import { IMPORT_COLUMNS } from "./columns";
import { ImageStep } from "./ImageStep";
import { emptyImageLibrary, type ImageLibrary } from "./images";
import { IssueList, issueLocation } from "./IssueList";
import { buildImportPlan } from "./mapping";
import { matchImages } from "./matching";
import { readSpreadsheet, SpreadsheetError } from "./parse";
import { ResolveStep } from "./ResolveStep";
import { buildTemplateCsv, TEMPLATE_FILENAME } from "./template";
import type { ImportPlan } from "./types";

// Steps that later phases wire up. Listed so editors can see the whole flow.
const UPCOMING_STEPS = [
  {
    title: "Choose draft or publish",
    description:
      "Drafts by default. Publishing makes rows marked active visible on the storefront and asks for confirmation first.",
  },
  {
    title: "Import",
    description:
      "Images upload first, then each product is created on its own. Existing products are skipped, never changed.",
  },
  {
    title: "Review results",
    description: "Download a report of created, skipped and failed rows.",
  },
];

const ACCESS_NOTICES: Record<ImportAccess, { tone: "caution" | "critical"; text: string } | null> = {
  publish: null,
  drafts: {
    tone: "caution",
    text: "Your role can create drafts but not publish. Publish mode won't be available.",
  },
  none: {
    tone: "critical",
    text: "Your role is read-only, so you can't import products. Ask a project administrator for Editor access.",
  },
  unknown: {
    tone: "caution",
    text: "Your role isn't one of Sanity's standard roles. Sanity will reject any write your role doesn't allow, and the import report will show it.",
  },
};

function downloadCsv(filename: string, text: string) {
  // The BOM makes Excel read the file as UTF-8, so ₦ and accents survive.
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function BulkImportTool() {
  const currentUser = useCurrentUser();
  const dataset = useDataset();
  const access = getImportAccess(currentUser?.roles.map((role) => role.name) ?? []);
  const notice = ACCESS_NOTICES[access];

  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  // Chosen images outlive a spreadsheet change, so a corrected file is matched
  // against them again. The match is derived, so it never refers to an old plan.
  const [library, setLibrary] = useState<ImageLibrary | null>(null);
  const match = useMemo(() => (plan && library ? matchImages(plan, library) : null), [plan, library]);
  // The Studio check matches against no files when none are chosen, so each
  // product is judged by the images it actually needs.
  const checkedImages = useMemo(
    () => (plan ? (match ?? matchImages(plan, emptyImageLibrary())) : null),
    [plan, match]
  );
  const [imagesReading, setImagesReading] = useState(false);

  const reset = () => {
    setFileName(null);
    setPlan(null);
    setFileError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    reset();
    setFileName(file.name);
    setReading(true);
    try {
      setPlan(buildImportPlan(await readSpreadsheet(file)));
    } catch (error) {
      setFileError(error instanceof SpreadsheetError ? error.message : "Couldn't read that file. Try saving it again.");
    } finally {
      setReading(false);
    }
  };

  return (
    <Box height="fill" overflow="auto" padding={[3, 4, 5]}>
      <Container width={2}>
        <Stack space={5}>
          <Stack space={3}>
            <Flex align="center" gap={3} wrap="wrap">
              <Heading as="h1" size={3}>
                Bulk product import
              </Heading>
              <Badge tone={dataset === "production" ? "caution" : "primary"}>Dataset: {dataset}</Badge>
            </Flex>
            <Text muted size={2}>
              Create many products at once from a spreadsheet and images on your device.
            </Text>
          </Stack>

          {dataset === "production" && (
            <Card padding={4} radius={2} shadow={1} tone="caution">
              <Text size={1}>
                This Studio writes to the production dataset, which the live storefront reads. Try new
                spreadsheets in a non-production dataset first.
              </Text>
            </Card>
          )}

          {notice && (
            <Card padding={4} radius={2} shadow={1} tone={notice.tone}>
              <Text size={1}>{notice.text}</Text>
            </Card>
          )}

          <Stack as="ol" space={3}>
            <Step number={1} title="Download the template" description="A CSV with every column the importer reads.">
              <Stack space={3}>
                <Flex>
                  <Button
                    icon={DownloadIcon}
                    mode="ghost"
                    text="Download template"
                    onClick={() => downloadCsv(TEMPLATE_FILENAME, buildTemplateCsv())}
                  />
                </Flex>
                <Card padding={3} radius={2} tone="primary">
                  <Text size={1}>
                    Using Excel? Before typing values, select the <code>handle</code> and <code>sku</code> columns
                    and set Format Cells → Text. Otherwise Excel turns values like 00123 into 123, and the
                    importer can&apos;t tell.
                  </Text>
                </Card>
                <ColumnGuide />
              </Stack>
            </Step>

            <Step
              number={2}
              title="Choose a spreadsheet"
              description="A .csv or .xlsx file. One row per product, or one row per variant sharing a handle. Nothing is saved yet."
            >
              <Stack space={3}>
                <Flex align="center" gap={2} wrap="wrap">
                  <Button
                    icon={DocumentSheetIcon}
                    mode="ghost"
                    text={fileName ? "Choose another file" : "Choose spreadsheet"}
                    loading={reading}
                    onClick={() => fileInput.current?.click()}
                  />
                  {fileName && !reading && (
                    <>
                      <Text size={1} muted>
                        {fileName}
                      </Text>
                      <Button icon={CloseIcon} mode="bleed" title="Clear" aria-label="Clear spreadsheet" onClick={reset} />
                    </>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    hidden
                    accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={chooseFile}
                  />
                </Flex>
                {fileError && (
                  <Card padding={3} radius={2} tone="critical">
                    <Text size={1}>{fileError}</Text>
                  </Card>
                )}
                {plan && <PlanSummary plan={plan} />}
              </Stack>
            </Step>

            <Step
              number={3}
              title="Choose images"
              description="Pick image files, a folder or ZIPs from this device. They're matched to products by the filenames in the spreadsheet, or by SKU when a product lists none."
            >
              <ImageStep
                plan={plan}
                library={library}
                match={match}
                onLibraryChange={setLibrary}
                onReadingChange={setImagesReading}
              />
            </Step>

            <Step
              number={4}
              title="Check against the Studio"
              description="Reads this dataset to flag products that already exist, slugs and SKUs already in use, and to look up collections and suppliers. Nothing is saved."
            >
              <ResolveStep
                plan={plan}
                images={checkedImages}
                imagesChosen={library !== null}
                imagesReading={imagesReading}
                workspaceDataset={dataset}
              />
            </Step>

            {UPCOMING_STEPS.map((step, index) => (
              <Step key={step.title} number={index + 5} title={step.title} description={step.description} upcoming />
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function Step({
  number,
  title,
  description,
  upcoming = false,
  children,
}: {
  number: number;
  title: string;
  description: string;
  upcoming?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card as="li" padding={4} radius={2} border>
      <Flex gap={3} align="flex-start">
        <Badge tone={upcoming ? "default" : "primary"}>{number}</Badge>
        <Stack flex={1} space={3}>
          <Stack space={2}>
            <Flex align="center" gap={2} wrap="wrap">
              <Text weight="semibold">{title}</Text>
              {upcoming && (
                <Badge tone="neutral" fontSize={0}>
                  Not available yet
                </Badge>
              )}
            </Flex>
            <Text muted size={1}>
              {description}
            </Text>
          </Stack>
          {children}
        </Stack>
      </Flex>
    </Card>
  );
}

function ColumnGuide() {
  return (
    <details>
      <summary style={{ cursor: "pointer" }}>
        <Text as="span" size={1}>
          Column guide
        </Text>
      </summary>
      <Stack as="dl" space={3} marginTop={3}>
        {IMPORT_COLUMNS.map((column) => (
          <Stack key={column.name} space={2}>
            <Flex gap={2} align="center" wrap="wrap">
              <Text as="dt" size={1} weight="semibold">
                <code>{column.name}</code>
              </Text>
              {column.required && (
                <Badge tone="caution" fontSize={0}>
                  Required
                </Badge>
              )}
            </Flex>
            <Text as="dd" size={1} muted style={{ margin: 0 }}>
              {column.description}
            </Text>
          </Stack>
        ))}
      </Stack>
    </details>
  );
}

function PlanSummary({ plan }: { plan: ImportPlan }) {
  const { summary } = plan;

  return (
    <Stack space={3}>
      <Card padding={3} radius={2} tone={summary.errors ? "critical" : "positive"}>
        <Stack space={2}>
          <Text size={1} weight="semibold">
            {summary.errors
              ? `${summary.rejectedProducts} product${summary.rejectedProducts === 1 ? "" : "s"} need fixing before import`
              : "Every product passed validation"}
          </Text>
          <Text size={1}>
            {summary.products} ready ({summary.simpleProducts} simple, {summary.variantProducts} with{" "}
            {summary.variants} variants) from {summary.rows} rows · {summary.errors} error
            {summary.errors === 1 ? "" : "s"} · {summary.warnings} warning{summary.warnings === 1 ? "" : "s"}
          </Text>
        </Stack>
      </Card>

      <IssueList
        items={plan.issues.map((issue) => ({
          severity: issue.severity,
          location: issueLocation(issue),
          message: issue.message,
        }))}
      />
    </Stack>
  );
}
