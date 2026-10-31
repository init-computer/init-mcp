export class InitApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "InitApiError";
    this.status = status;
    this.details = details;
  }
}

export function createClient(options = {}) {
  const apiKey = options.apiKey ?? process.env.INIT_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.INIT_API_BASE_URL ?? "https://api.init.computer";
  const request = async (path, init = {}) => {
    if (!apiKey) {
      throw new InitApiError(401, "INIT_API_KEY is required. Pass apiKey to createClient or set INIT_API_KEY.");
    }
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${apiKey}`);
    const inputBody = init.body;
    const isFormData = typeof FormData !== "undefined" && inputBody instanceof FormData;
    const isBlob = typeof Blob !== "undefined" && inputBody instanceof Blob;
    const isArrayBuffer = typeof ArrayBuffer !== "undefined" && inputBody instanceof ArrayBuffer;
    const requestBody = inputBody && typeof inputBody === "object" && !isFormData && !isBlob && !isArrayBuffer
      ? JSON.stringify(inputBody)
      : inputBody;
    if (requestBody && !isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      body: requestBody,
      headers,
    });
    const responseBody = await response.json().catch(() => null);
    if (!response.ok) throw new InitApiError(response.status, responseBody?.errors?.[0]?.message || responseBody?.message || `Init API request failed (${response.status}).`, responseBody);
    return responseBody?.success === true && "result" in responseBody ? responseBody.result : responseBody;
  };
  const json = (body) => ({ method: "POST", body });
  return {
    identity: () => request("/v1/identity"),
    usage: () => request("/v1/usage"),
    public: { inspect: slug => request(`/v1/public/${encodeURIComponent(slug)}/inspect`), use: slug => request(`/v1/public/${encodeURIComponent(slug)}/use`, json({})) },
    generate: (body) => request("/v1/generate", json(body)),
    project: {
      generate: (body) => request("/v1/generate/project", json(body)),
      edit: (projectId, body) => request(`/v1/generate/project/${projectId}/edit`, json(body)),
      importInitJson: (manifest, options = {}) => request("/v1/generate/project/import", json({ manifest, ...options })),
      toInitJson: async (projectId) => {
        const detail = await request(`/v1/directories/${projectId}`);
        const directory = detail.directory || detail;
        const entries = Array.isArray(detail.entries) ? detail.entries : [];
        const resources = await Promise.all(entries.map(async (entry) => {
          const resource = await request(`/v1/resources/${entry.id}`);
          return {
            id: resource.id,
            name: resource.name,
            description: resource.description,
            route: resource.url || resource.route,
            method: resource.method,
            requestFormat: resource.requestFormat,
            status: resource.status,
            version: resource.version,
            input: resource.inputStructure?.input ?? resource.inputStructure ?? {},
            output: resource.outputStructure?.output ?? resource.outputStructure ?? {},
            data: resource.data ?? {},
          };
        }));
        return { schemaVersion: 1, project: { id: directory.id, name: directory.name, description: directory.description, version: 1 }, resources, tables: [] };
      },
      applyInitJson: async (manifest, options = {}) => {
        const existingId = manifest?.project?.id;
        const result = existingId && options.prompt
          ? await request(`/v1/generate/project/${existingId}/edit`, json({ prompt: options.prompt, reasoningMode: options.reasoningMode }))
          : await request("/v1/generate/project/import", json({ manifest, reasoningMode: options.reasoningMode }));
        const projectId = result?.project?.id || existingId;
        if (!projectId) throw new InitApiError(500, "Init did not return a project ID.");
        return { result, initJson: await requestProjectInitJson(projectId, request) };
      },
    },
    resource: { list: (query = {}) => request(`/v1/resources?${new URLSearchParams(query)}`), get: (id) => request(`/v1/resources/${id}`), update: (id, body) => request(`/v1/resources/${id}`, { method: "PATCH", body }), versions: (id) => request(`/v1/resources/${id}/versions`), activateVersion: (id, versionId) => request(`/v1/resources/${id}/versions/${versionId}/activate`, { method: "POST" }) },
    directory: { list: (query = {}) => request(`/v1/directories?${new URLSearchParams(query)}`), get: (id) => request(`/v1/directories/${id}`), create: (body) => request("/v1/directories", json(body)) },
    daemon: { list: () => request("/v1/daemons"), create: (body) => request("/v1/daemons", json(body)), run: (id) => request(`/v1/daemons/${id}/run`, { method: "POST" }) },
    pkg: { list: (query = {}) => request(`/v1/packages?${new URLSearchParams(query)}`) },
    run: (route, body, options = {}) => {
      let runtimePath = String(route).trim();
      if (/^https?:\/\//i.test(runtimePath)) {
        const endpoint = new URL(runtimePath);
        const configured = new URL(baseUrl);
        if (endpoint.username || endpoint.password || ![configured.origin, "https://api.init.computer"].includes(endpoint.origin)) {
          throw new InitApiError(400, "Run URLs must belong to the configured Init API origin.");
        }
        runtimePath = endpoint.pathname + endpoint.search;
      }
      if (!/^\/?v\d+\//.test(runtimePath)) runtimePath = `/v${options.version || 1}/${runtimePath.replace(/^\/+/, "")}`;
      else runtimePath = `/${runtimePath.replace(/^\/+/, "")}`;
      const headers = options.version ? { "X-Init-Version": String(options.version) } : {};
      return request(runtimePath, { method: "POST", body, headers });
    },
  };
}

async function requestProjectInitJson(projectId, request) {
  const detail = await request(`/v1/directories/${projectId}`);
  const directory = detail.directory || detail;
  const entries = Array.isArray(detail.entries) ? detail.entries : [];
  const resources = await Promise.all(entries.map(async (entry) => {
    const resource = await request(`/v1/resources/${entry.id}`);
    return { id: resource.id, name: resource.name, description: resource.description, route: resource.url || resource.route, method: resource.method, requestFormat: resource.requestFormat, status: resource.status, version: resource.version, input: resource.inputStructure?.input ?? resource.inputStructure ?? {}, output: resource.outputStructure?.output ?? resource.outputStructure ?? {}, data: resource.data ?? {} };
  }));
  return { schemaVersion: 1, project: { id: directory.id, name: directory.name, description: directory.description, version: 1 }, resources, tables: [] };
}
