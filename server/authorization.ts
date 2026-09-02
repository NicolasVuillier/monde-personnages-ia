export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getAuthenticatedEmail(request: Request): string | null {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLocaleLowerCase("en");
  if (email) return email;

  const previewEmail = process.env.WEBMCP_PREVIEW_EMAIL?.trim().toLocaleLowerCase("en");
  return previewEmail || null;
}

export function requireWebMcpAdmin(request: Request): string {
  const email = getAuthenticatedEmail(request);
  if (!email) {
    throw new HttpError(401, "Connecte-toi avec ChatGPT pour modifier ce monde.");
  }

  const allowed = (process.env.WEBMCP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLocaleLowerCase("en"))
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes(email)) {
    throw new HttpError(403, "Ce compte peut explorer la carte, mais pas publier de personnages.");
  }

  return email;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Une erreur inattendue a interrompu l’action." }, { status: 500 });
}
