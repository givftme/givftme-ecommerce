import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";

const publicDir = path.join(process.cwd(), "public");

export const DEFAULT_OG_IMAGE = readFileSync(path.join(publicDir, "og-default.jpg"));
// Any real PNG works as a stand-in for a remote product or avatar image.
const SAMPLE_PNG = readFileSync(path.join(publicDir, "logo.png"));

/**
 * Serves /public assets and a few fake remote images to code under test, the
 * way the deployment origin and image hosts would.
 */
export function stubOgFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());

    if (url.hostname === "localhost") {
      try {
        const file = readFileSync(path.join(publicDir, url.pathname));
        return new Response(file, { status: 200 });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    }

    if (url.pathname.endsWith(".png")) {
      return new Response(SAMPLE_PNG, { headers: { "content-type": "image/png" } });
    }

    if (url.pathname.endsWith(".webp")) {
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp" } });
    }

    return new Response("Not found", { status: 404 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function ogRequest(route: string) {
  return new Request(`http://localhost:3000${route}`);
}

export async function isDefaultOgImage(response: Response) {
  const body = Buffer.from(await response.arrayBuffer());
  return body.equals(DEFAULT_OG_IMAGE);
}
