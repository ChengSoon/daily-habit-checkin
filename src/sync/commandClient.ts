import { apiRequest, getAuthorizationHeaders } from "./apiClient";

export function postCommand<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body });
}

export const commandAuthorizationHeaders = getAuthorizationHeaders;
