export class InitApiError extends Error {
  status: number;
  details: unknown;
  constructor(status: number, message: string, details?: unknown);
}

export type InitClientOptions = {
  apiKey?: string;
  baseUrl?: string;
};

export type RunOptions = {
  version?: number;
  requestFormat?: string;
};

export function createClient(options?: InitClientOptions): {
  identity(): Promise<Record<string, unknown>>;
  usage(): Promise<Record<string, unknown>>;
  public: { inspect(slug: string): Promise<any>; use(slug: string): Promise<any> };
  generate(body: Record<string, unknown>): Promise<any>;
  project: {
    generate(body: { prompt: string; name?: string; description?: string; reasoningMode?: string }): Promise<any>;
    edit(projectId: string, body: { prompt: string; reasoningMode?: string }): Promise<any>;
    importInitJson(manifest: Record<string, unknown>, options?: { reasoningMode?: string }): Promise<any>;
    toInitJson(projectId: string): Promise<any>;
    applyInitJson(manifest: Record<string, any>, options?: { prompt?: string; reasoningMode?: string }): Promise<{ result: any; initJson: Record<string, unknown> }>;
  };
  resource: {
    list(query?: Record<string, string | number | boolean>): Promise<any>;
    get(id: string): Promise<any>;
    update(id: string, body: Record<string, unknown>): Promise<any>;
    versions(id: string): Promise<any>;
    activateVersion(id: string, versionId: string): Promise<any>;
  };
  pkg: { list(query?: Record<string, string | number | boolean>): Promise<any> };
  run(route: string, body: Record<string, unknown> | FormData, options?: RunOptions): Promise<any>;
};
