type RouteExpectation = {
  path: string;
  expected: "ok" | "authRedirect";
};

type RouteCheck = RouteExpectation & {
  status: number | "error";
  location: string;
  passed: boolean;
  note: string;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const ROUTES: RouteExpectation[] = [
  { path: "/", expected: "ok" },
  { path: "/catalog", expected: "ok" },
  { path: "/showcase/skill", expected: "ok" },
  { path: "/auth/login", expected: "ok" },
  { path: "/auth/signup", expected: "ok" },
  { path: "/practice", expected: "authRedirect" },
  { path: "/studio", expected: "authRedirect" },
  { path: "/student/dashboard", expected: "authRedirect" },
  { path: "/teacher/dashboard", expected: "authRedirect" },
  { path: "/admin/dashboard", expected: "authRedirect" },
];

function normalizeBaseUrl(rawBaseUrl: string) {
  return rawBaseUrl.replace(/\/+$/, "");
}

function formatExpectation(expected: RouteExpectation["expected"]) {
  return expected === "ok" ? "200 page" : "auth redirect";
}

function hasFrameworkError(body: string) {
  return body.includes("__next_error__") || body.includes("Application error") || body.includes("Unhandled Runtime Error");
}

function isAuthRedirect(status: number, location: string) {
  return status >= 300 && status < 400 && location.includes("/auth/login");
}

async function checkRoute(baseUrl: string, route: RouteExpectation): Promise<RouteCheck> {
  const url = new URL(route.path, baseUrl);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const location = response.headers.get("location") ?? "";

    if (route.expected === "authRedirect") {
      const passed = isAuthRedirect(response.status, location);
      return {
        ...route,
        status: response.status,
        location,
        passed,
        note: passed ? "redirects to login" : "expected protected route to redirect to login",
      };
    }

    const body = await response.text();
    const passed = response.status === 200 && body.trim().length > 0 && !hasFrameworkError(body);
    return {
      ...route,
      status: response.status,
      location,
      passed,
      note: passed ? "renders page" : "expected a non-empty 200 page without a framework error",
    };
  } catch (error) {
    return {
      ...route,
      status: "error",
      location: "",
      passed: false,
      note: error instanceof Error ? error.message : "request failed",
    };
  }
}

function printResults(results: RouteCheck[]) {
  console.table(
    results.map((result) => ({
      route: result.path,
      expected: formatExpectation(result.expected),
      status: result.status,
      location: result.location || "-",
      result: result.passed ? "pass" : "fail",
      note: result.note,
    })),
  );
}

const baseUrl = normalizeBaseUrl(process.env.EDSYNC_BASE_URL ?? DEFAULT_BASE_URL);
const results = await Promise.all(ROUTES.map((route) => checkRoute(baseUrl, route)));
const failures = results.filter((result) => !result.passed);

console.log(`Checking EdSync local routes at ${baseUrl}`);
printResults(results);

if (failures.length > 0) {
  console.error("Local route smoke check failed.");
  process.exit(1);
}

console.log("Local route smoke check passed.");

export {};
