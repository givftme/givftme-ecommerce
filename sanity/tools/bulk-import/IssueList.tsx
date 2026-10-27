import { Badge, Card, Flex, Stack, Text } from "@sanity/ui";
import type { ImportIssue, IssueSeverity } from "./types";

export interface IssueItem {
  severity: IssueSeverity;
  /** Where the issue is, e.g. "Row 4 · price · leather-bag". */
  location: string;
  message: string;
}

/** "Row 4 · price · leather-bag"; issues without a row use the fallback. */
export function issueLocation(issue: ImportIssue, fallback = "File") {
  return [issue.row ? `Row ${issue.row}` : fallback, issue.column, issue.handle].filter(Boolean).join(" · ");
}

export function IssueList({ items, limit = 200 }: { items: IssueItem[]; limit?: number }) {
  if (!items.length) return null;
  const shown = items.slice(0, limit);

  return (
    <Stack space={2}>
      <Card radius={2} border>
        <Stack as="ul" space={0}>
          {shown.map((item, index) => (
            <Card as="li" key={index} padding={3} borderBottom={index < shown.length - 1}>
              <Flex gap={3} align="flex-start">
                <Badge tone={item.severity === "error" ? "critical" : "caution"} fontSize={0}>
                  {item.severity === "error" ? "Error" : "Warning"}
                </Badge>
                <Stack flex={1} space={2}>
                  <Text size={1} muted>
                    {item.location}
                  </Text>
                  <Text size={1}>{item.message}</Text>
                </Stack>
              </Flex>
            </Card>
          ))}
        </Stack>
      </Card>
      {items.length > shown.length && (
        <Text size={1} muted>
          And {items.length - shown.length} more. Fix these and choose the files again.
        </Text>
      )}
    </Stack>
  );
}
