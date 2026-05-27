import { buildServiceWorkerScript } from "@/lib/pwa/service-worker-script";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildServiceWorkerScript(), {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Content-Type": "application/javascript; charset=utf-8",
    },
  });
}
