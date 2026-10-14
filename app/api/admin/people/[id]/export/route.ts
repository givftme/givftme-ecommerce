import { isUuid, requireAdminApi } from "@/lib/admin/auth";
import { buildPersonExport } from "@/lib/admin/data/people";
import { createZip } from "@/lib/admin/zip";
import { jsonError } from "@/lib/api/response";

interface PersonRouteContext {
  params: Promise<{ id: string }>;
}

// Data-access request: everything held about one person, as a ZIP of JSON.
export async function GET(_request: Request, context: PersonRouteContext) {
  const { id } = await context.params;
  if (!isUuid(id)) return jsonError("Person not found.", 404);

  const auth = await requireAdminApi("people", { audit: { action: "export_person", targetType: "user", targetId: id } });
  if (!auth.ok) return auth.response;

  try {
    const entries = await buildPersonExport(auth.service, id);
    if (!entries) return jsonError("Person not found.", 404);
    const zip = createZip(entries);
    return new Response(zip.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="givftme-data-${id}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Could not export person data.", error);
    return jsonError("Couldn't build the export. Try again.", 500);
  }
}
