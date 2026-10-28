import { PublishIcon, SearchIcon, StopIcon, UploadIcon } from "@sanity/icons";
import { Badge, Button, Card, Checkbox, Flex, Radio, Stack, Text } from "@sanity/ui";
import { useRef, useState } from "react";
import {
  useClient,
  useCurrentUser,
  useGrantsStore,
  useProjectId,
  useWorkspace,
  validateDocument,
  type SanityDocument,
} from "sanity";
import { apiVersion } from "@/sanity/env";
import type { ImportAccess } from "./access";
import {
  createImportSession,
  runDraftImport,
  runDraftPreflight,
  unusedAssets,
  type DraftImportDeps,
  type ImportProgress,
  type ImportRun,
  type ImportSession,
  type PreflightResult,
  type ProductImportResult,
  type ProductImportStatus,
} from "./execute";
import type { ImageMatchResult } from "./matching";
import { checkDraftCreate, checkPublishCreate } from "./permissions";
import { summarizePublish, type PublishSummary } from "./publishing";
import type { ResolutionResult } from "./resolve";
import type { CompletedCheck } from "./ResolveStep";
import { publishableDatasetProblem, writableDatasetProblem, type ImportMode } from "./safety";
import type { ImportPlan } from "./types";
import { formatBytes } from "./zip";

// Step 5: creates the checked products as drafts, or, when chosen, creates and
// publishes them. Only offered for a check that still matches the
// spreadsheet, images and dataset, in an allowlisted dataset, after the editor
// confirms; publishing products that go live also needs a tick. One import
// runs at a time; a retry covers only what didn't get written, in the same
// mode, and reuses what was already uploaded.

const STATUS: Record<ProductImportStatus, { label: string; tone: "positive" | "caution" | "critical" | "default" }> = {
  published: { label: "Published", tone: "positive" },
  created: { label: "Created", tone: "positive" },
  uncertain: { label: "Unclear", tone: "caution" },
  failed: { label: "Failed", tone: "critical" },
  "not-attempted": { label: "Not attempted", tone: "default" },
  skipped: { label: "Skipped", tone: "default" },
};
const STATUS_ORDER: ProductImportStatus[] = ["failed", "uncertain", "not-attempted", "skipped", "published", "created"];
const WRITTEN: ProductImportStatus[] = ["created", "published"];

interface Report {
  /** The check this report belongs to; retries need the same one. */
  preview: ResolutionResult;
  /** How these products were written; retries use the same. */
  mode: ImportMode;
  /** Latest result per product, across the first run and its retries. */
  results: Map<string, ProductImportResult>;
  lastRun: ImportRun;
  unused: { filename: string; assetId: string }[];
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function describeProgress(progress: ImportProgress, mode: ImportMode) {
  if (progress.phase === "checking") return "Checking the Studio again…";
  if (progress.phase === "uploading") return `Uploading images: ${progress.done} of ${progress.total}…`;
  const doing = mode === "publish" ? "Publishing products" : "Creating drafts";
  return `${doing}: ${progress.done} of ${progress.total} (${progress.title})…`;
}

export function ImportStep({
  plan,
  images,
  preview,
  workspaceDataset,
  access,
}: {
  plan: ImportPlan | null;
  images: ImageMatchResult | null;
  /** The Studio check, only while it matches the spreadsheet and images on screen. */
  preview: CompletedCheck | null;
  workspaceDataset: string;
  access: ImportAccess;
}) {
  const client = useClient({ apiVersion });
  const projectId = useProjectId();
  const grants = useGrantsStore();
  const workspace = useWorkspace();
  const currentUser = useCurrentUser();
  const { dataset = "", projectId: clientProjectId = "" } = client.config();

  const running = useRef(false);
  const stopRequested = useRef(false);
  const session = useRef<{ preview: ResolutionResult; data: ImportSession } | null>(null);
  const [chosenMode, setChosenMode] = useState<ImportMode>("draft");
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runningMode, setRunningMode] = useState<ImportMode>("draft");
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [preflight, setPreflight] = useState<{ preview: ResolutionResult; mode: ImportMode; result: PreflightResult } | null>(
    null
  );

  const datasetProblem = writableDatasetProblem(workspaceDataset);
  // Role names only decide what's offered; the grants check decides what's allowed.
  const publishProblem =
    publishableDatasetProblem(workspaceDataset) ??
    (access === "drafts" ? "Your role can create drafts but not publish them." : null);
  const mode: ImportMode = publishProblem ? "draft" : chosenMode;
  const live =
    preview && preview.inputs.dataset === dataset && preview.inputs.projectId === clientProjectId ? preview : null;
  const importable = live ? live.result.summary.ready + live.result.summary.warning : 0;
  const publishing = live && plan ? summarizePublish(plan, live.result) : null;
  const needsTick = mode === "publish" && Boolean(publishing?.live);
  const reportIsCurrent = Boolean(report && live && report.preview === live.result);
  const retryIds = reportIsCurrent
    ? [...report!.results.values()]
        .filter((result) => result.retryable && !WRITTEN.includes(result.status))
        .map((result) => result.documentId)
    : [];

  const checks: Pick<DraftImportDeps, "client" | "workspace" | "checkPermission" | "validate"> = {
    client,
    workspace: { projectId, dataset: workspaceDataset },
    checkPermission: (document, kind) =>
      kind === "publish" ? checkPublishCreate(grants, document) : checkDraftCreate(grants, document),
    validate: (document, options) =>
      validateDocument({
        document: document as unknown as SanityDocument,
        workspace,
        environment: "studio",
        currentUser,
        ...options,
      }),
  };

  const chooseMode = (next: ImportMode) => {
    setChosenMode(next);
    setConfirming(false);
    setAcknowledged(false);
  };

  // Every check the import makes, with no writes: only reads.
  const runPreflight = async () => {
    if (running.current || !live || !plan || !images || datasetProblem || access === "none") return;
    running.current = true;
    setChecking(true);
    setFailure(null);
    try {
      const result = await runDraftPreflight({ plan, images, preview: live.result, mode }, checks);
      setPreflight({ preview: live.result, mode, result });
    } catch (error) {
      console.error("Bulk import: the preflight couldn't run", error);
      setFailure("The permission and schema check couldn't run. Try again.");
    } finally {
      running.current = false;
      setChecking(false);
    }
  };

  const start = async (runMode: ImportMode, only?: ReadonlySet<string>) => {
    // A second click, or a click from a stale render, is ignored.
    if (running.current || !live || !plan || !images || datasetProblem || access === "none") return;
    if (runMode === "publish" && publishProblem) return;
    running.current = true;
    stopRequested.current = false;
    setConfirming(false);
    setStopping(false);
    setFailure(null);
    setRunningMode(runMode);
    setIsRunning(true);
    if (session.current?.preview !== live.result) session.current = { preview: live.result, data: createImportSession() };
    const current = session.current;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);

    try {
      const run = await runDraftImport(
        { plan, images, preview: live.result, only, session: current.data, mode: runMode },
        { ...checks, shouldStop: () => stopRequested.current, onProgress: setProgress }
      );
      setReport((previous) => {
        const results = new Map(previous?.preview === live.result ? previous.results : []);
        for (const result of run.results) results.set(result.documentId, result);
        return { preview: live.result, mode: runMode, results, lastRun: run, unused: unusedAssets(current.data, images) };
      });
    } catch (error) {
      console.error("Bulk import: the import couldn't run", error);
      setFailure("The import couldn't run. Check the Structure tool for drafts before trying again.");
    } finally {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      running.current = false;
      setIsRunning(false);
      setStopping(false);
      setProgress(null);
      setAcknowledged(false);
    }
  };

  const requestStop = () => {
    stopRequested.current = true;
    setStopping(true);
  };

  if (!plan) {
    return (
      <Text size={1} muted>
        Choose a spreadsheet first.
      </Text>
    );
  }

  return (
    <Stack space={4}>
      <Text size={1} muted>
        Drafts by default: drafts aren&apos;t on the storefront. Publishing is a separate choice that asks for
        confirmation. Existing products are never changed.
      </Text>

      {datasetProblem && (
        <Card padding={3} radius={2} tone="caution">
          <Text size={1}>{datasetProblem}</Text>
        </Card>
      )}
      {access === "none" && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>Your role is read-only, so you can&apos;t import products.</Text>
        </Card>
      )}

      {!datasetProblem && access !== "none" && !live && !isRunning && (
        <Text size={1} muted>
          Run the Studio check in step 4 first. The import uses its results, so it has to match the current spreadsheet
          and images.
        </Text>
      )}

      {!datasetProblem && access !== "none" && live && !reportIsCurrent && !isRunning && (
        <Stack space={3}>
          {importable === 0 ? (
            <Text size={1} muted>
              No products can be imported. Fix the blocked products and check again.
            </Text>
          ) : (
            <>
              <ModeChoice mode={mode} publishProblem={publishProblem} onChange={chooseMode} />

              {mode === "publish" && publishing ? (
                <PublishOverview summary={publishing} dataset={dataset} result={live.result} />
              ) : (
                <Text size={1}>
                  Creates {plural(importable, "draft")} in &quot;{dataset}&quot;, uploading{" "}
                  {plural(live.result.summary.uploadImages, "image file")} ({formatBytes(live.result.summary.uploadBytes)})
                  first.{" "}
                  {live.result.summary.blocked > 0 && `${plural(live.result.summary.blocked, "blocked product")} will be skipped.`}
                </Text>
              )}

              {confirming ? (
                <Card padding={3} radius={2} tone="caution" border>
                  <Stack space={3}>
                    {mode === "publish" ? (
                      <>
                        <Text size={1} weight="semibold">
                          Create and publish {plural(importable, "product")} in the &quot;{dataset}&quot; dataset (project{" "}
                          {clientProjectId})?
                        </Text>
                        <Text size={1}>
                          Each product is created and published in one step, so a product that already exists is never
                          replaced. The Studio is checked again first, and anything that changed is skipped or reported.
                        </Text>
                        {needsTick && (
                          <Flex as="label" align="center" gap={2}>
                            <Checkbox
                              checked={acknowledged}
                              onChange={(event) => setAcknowledged(event.currentTarget.checked)}
                            />
                            <Text size={1} weight="semibold">
                              I understand {plural(publishing!.live, "product")} will be visible on the storefront.
                            </Text>
                          </Flex>
                        )}
                      </>
                    ) : (
                      <>
                        <Text size={1} weight="semibold">
                          Create {plural(importable, "product draft")} in the &quot;{dataset}&quot; dataset (project{" "}
                          {clientProjectId})?
                        </Text>
                        <Text size={1}>
                          The Studio is checked again first. Anything that changed since the check is skipped or
                          reported, never overwritten. Images are uploaded to this dataset&apos;s media library and stay
                          there.
                        </Text>
                      </>
                    )}
                    <Flex gap={2} wrap="wrap">
                      {mode === "publish" ? (
                        <Button
                          icon={PublishIcon}
                          tone="primary"
                          text={`Publish ${plural(importable, "product")}`}
                          disabled={needsTick && !acknowledged}
                          onClick={() => void start("publish")}
                        />
                      ) : (
                        <Button
                          icon={UploadIcon}
                          tone="primary"
                          text={`Create ${plural(importable, "draft")}`}
                          onClick={() => void start("draft")}
                        />
                      )}
                      <Button mode="ghost" text="Cancel" onClick={() => chooseMode(mode)} />
                    </Flex>
                  </Stack>
                </Card>
              ) : (
                <Flex gap={2} wrap="wrap">
                  <Button
                    icon={SearchIcon}
                    mode="ghost"
                    text="Check permissions and schema (no changes)"
                    loading={checking}
                    disabled={checking}
                    onClick={() => void runPreflight()}
                  />
                  <Button
                    icon={mode === "publish" ? PublishIcon : UploadIcon}
                    mode="ghost"
                    text={
                      mode === "publish"
                        ? `Create and publish ${plural(importable, "product")}`
                        : `Import ${plural(importable, "product")} as drafts`
                    }
                    disabled={checking}
                    onClick={() => setConfirming(true)}
                  />
                </Flex>
              )}
              {preflight?.preview === live.result && preflight.mode === mode && !checking && (
                <PreflightReport result={preflight.result} mode={mode} />
              )}
            </>
          )}
        </Stack>
      )}

      {isRunning && (
        <Card padding={3} radius={2} border>
          <Flex align="center" gap={3} wrap="wrap">
            <Text size={1}>
              {stopping ? "Stopping after the current step…" : progress ? describeProgress(progress, runningMode) : "Starting…"}
            </Text>
            <Button icon={StopIcon} mode="ghost" tone="critical" text="Stop" disabled={stopping} onClick={requestStop} />
          </Flex>
        </Card>
      )}

      {failure && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>{failure}</Text>
        </Card>
      )}

      {report && !isRunning && (
        <ImportReport
          report={report}
          current={reportIsCurrent}
          retryCount={retryIds.length}
          onRetry={() => void start(report.mode, new Set(retryIds))}
        />
      )}
    </Stack>
  );
}

function ModeChoice({
  mode,
  publishProblem,
  onChange,
}: {
  mode: ImportMode;
  publishProblem: string | null;
  onChange: (mode: ImportMode) => void;
}) {
  return (
    <Stack space={2}>
      <Flex as="label" align="center" gap={2}>
        <Radio name="import-mode" value="draft" checked={mode === "draft"} onChange={() => onChange("draft")} />
        <Text size={1}>Create drafts</Text>
      </Flex>
      <Flex as="label" align="center" gap={2}>
        <Radio
          name="import-mode"
          value="publish"
          checked={mode === "publish"}
          disabled={Boolean(publishProblem)}
          onChange={() => onChange("publish")}
        />
        <Text size={1} muted={Boolean(publishProblem)}>
          Create and publish
        </Text>
      </Flex>
      {publishProblem && (
        <Text size={1} muted>
          {publishProblem}
        </Text>
      )}
    </Stack>
  );
}

function PublishOverview({ summary, dataset, result }: { summary: PublishSummary; dataset: string; result: ResolutionResult }) {
  return (
    <Stack space={2}>
      <Text size={1}>
        Creates and publishes {plural(summary.products, "product")} in &quot;{dataset}&quot;, uploading{" "}
        {plural(result.summary.uploadImages, "image file")} ({formatBytes(result.summary.uploadBytes)}) first.{" "}
        {result.summary.blocked > 0 && `${plural(result.summary.blocked, "blocked product")} will be skipped.`}
      </Text>
      <Text size={1}>
        {summary.live} will be live on the storefront (status active) · {summary.hidden} will be published but stay hidden
        (status draft or archived)
      </Text>
      {summary.warnings.length > 0 && (
        <Card padding={3} radius={2} tone="caution">
          <Stack as="ul" space={2} style={{ margin: 0, paddingLeft: "1.25em" }}>
            {summary.warnings.map((warning, index) => (
              <Text as="li" key={index} size={1} data-publish-warning={warning.handle}>
                {warning.title}: {warning.message}
              </Text>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

function PreflightReport({ result, mode }: { result: PreflightResult; mode: ImportMode }) {
  const count = (status: PreflightResult["products"][number]["status"]) =>
    result.products.filter((product) => product.status === status).length;
  const failed = count("failed");

  if (result.stopped) {
    return (
      <Card padding={3} radius={2} tone="critical">
        <Text size={1}>{result.stopped.message}</Text>
      </Card>
    );
  }
  return (
    <Card padding={3} radius={2} tone={failed ? "critical" : "positive"}>
      <Stack space={3}>
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Preflight: {count("ready")} ready · {failed} failed · {count("skipped")} skipped
          </Text>
          <Text size={1}>
            Checked your permission to {mode === "publish" ? "create and publish each product" : "create each draft"} in
            &quot;{result.target.dataset}&quot;, and each complete draft against the product schema, with{" "}
            {plural(result.uploads.images, "image")} ({formatBytes(result.uploads.bytes)}) still to upload. Nothing was
            uploaded or saved.
          </Text>
        </Stack>
        {result.products
          .filter((product) => product.status !== "ready")
          .map((product) => (
            <Text key={product.draftId} size={1} data-preflight-status={product.status}>
              {product.title} ({product.status}): {product.message}
            </Text>
          ))}
      </Stack>
    </Card>
  );
}

function ImportReport({
  report,
  current,
  retryCount,
  onRetry,
}: {
  report: Report;
  current: boolean;
  retryCount: number;
  onRetry: () => void;
}) {
  const results = [...report.results.values()].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );
  const count = (status: ProductImportStatus) => results.filter((result) => result.status === status).length;
  const { lastRun } = report;
  const publishing = report.mode === "publish";
  const written = count("created") + count("published");
  const problems = count("failed") + count("uncertain") + count("not-attempted");

  return (
    <Stack space={3}>
      {!current && (
        <Card padding={3} radius={2} tone="caution">
          <Text size={1}>
            This report is from an earlier check. Products it lists as created or published still exist. Run the check
            again before importing more.
          </Text>
        </Card>
      )}
      {lastRun.stopped && (
        <Card padding={3} radius={2} tone={lastRun.stopped.reason === "cancelled" ? "caution" : "critical"}>
          <Text size={1}>{lastRun.stopped.message}</Text>
        </Card>
      )}

      <Card padding={3} radius={2} tone={problems ? (written ? "caution" : "critical") : "positive"}>
        <Stack space={2}>
          <Text size={1} weight="semibold">
            {publishing
              ? `${plural(count("published"), "product")} published in "${lastRun.target.dataset}"`
              : `${plural(count("created"), "draft")} created in "${lastRun.target.dataset}"`}
          </Text>
          <Text size={1}>
            {count("failed")} failed · {count("uncertain")} unclear · {count("not-attempted")} not attempted ·{" "}
            {count("skipped")} skipped
          </Text>
          <Text size={1} muted>
            Last run: {plural(lastRun.uploads.uploaded, "image")} uploaded, {lastRun.uploads.reused} reused,{" "}
            {lastRun.uploads.failed} failed.{" "}
            {publishing
              ? "Existing products were not changed, and nothing was deleted."
              : "Nothing was published, patched or deleted."}
          </Text>
        </Stack>
      </Card>

      {report.unused.length > 0 && (
        <Card padding={3} radius={2} tone="caution">
          <Stack space={2}>
            <Text size={1} weight="semibold">
              {plural(report.unused.length, "uploaded image")} {report.unused.length === 1 ? "isn't" : "aren't"} used by
              any {publishing ? "imported product" : "created draft"}
            </Text>
            <Text size={1}>
              {report.unused.map((asset) => `${asset.filename} (${asset.assetId})`).join(", ")}. They stay in the media
              library; nothing is deleted. A retry reuses them.
            </Text>
          </Stack>
        </Card>
      )}

      {current && retryCount > 0 && (
        <Stack space={2}>
          <Flex>
            <Button mode="ghost" text={`Retry ${plural(retryCount, "product")}`} onClick={onRetry} />
          </Flex>
          <Text size={1} muted>
            A retry {publishing ? "publishes, as before," : "creates drafts, as before,"} after checking the Studio again,
            and reads back anything unclear before writing it again.
          </Text>
        </Stack>
      )}

      <Stack space={2}>
        {results.map((result) => (
          <Card key={result.documentId} padding={3} radius={2} border data-import-status={result.status}>
            <Stack space={2}>
              <Flex align="center" gap={2} wrap="wrap">
                <Text size={1} weight="semibold">
                  {result.title}
                </Text>
                <Text size={1} muted>
                  {result.handle}
                </Text>
                <Badge tone={STATUS[result.status].tone} fontSize={0}>
                  {STATUS[result.status].label}
                </Badge>
              </Flex>
              <Text size={1}>{result.message}</Text>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
