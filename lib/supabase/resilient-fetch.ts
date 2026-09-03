const JWT_FUTURE_RETRY_DELAYS_MS = [250, 700, 1500] as const;
const JWT_FUTURE_JITTER_MS = 150;

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

type PostgrestErrorBody = {
  code?: unknown;
  message?: unknown;
};

function requestUrl(input: FetchInput) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isPostgrestRequest(input: FetchInput) {
  try {
    const base = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    return new URL(requestUrl(input), base).pathname.includes("/rest/v1/");
  } catch {
    return false;
  }
}

function cloneFetchInput(input: FetchInput): FetchInput {
  return input instanceof Request ? input.clone() : input;
}

function hasStreamingBody(init?: FetchInit) {
  if (!init?.body || typeof ReadableStream === "undefined") return false;
  return init.body instanceof ReadableStream;
}

async function isJwtIssuedAtFutureResponse(response: Response) {
  if (response.ok) return false;

  try {
    const body = (await response.clone().json()) as PostgrestErrorBody;
    return (
      body.code === "PGRST303" &&
      typeof body.message === "string" &&
      body.message.toLowerCase().includes("jwt issued at future")
    );
  } catch {
    return false;
  }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

/**
 * Retries only the known transient PostgREST PGRST303 "JWT issued at future"
 * failure. Authentication, authorization and RLS failures are never retried or
 * weakened. The same signed token is reused so a refresh cannot move `iat`
 * further forward while PostgREST's validator catches up.
 */
export function createResilientSupabaseFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    if (!isPostgrestRequest(input) || hasStreamingBody(init)) {
      return baseFetch(input, init);
    }

    let response = await baseFetch(cloneFetchInput(input), init);

    for (const delay of JWT_FUTURE_RETRY_DELAYS_MS) {
      if (!(await isJwtIssuedAtFutureResponse(response))) {
        return response;
      }

      const jitter = Math.floor(Math.random() * (JWT_FUTURE_JITTER_MS + 1));
      await sleep(delay + jitter);
      response = await baseFetch(cloneFetchInput(input), init);
    }

    return response;
  };
}
