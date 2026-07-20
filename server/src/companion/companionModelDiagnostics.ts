import type { ResolvedCompanionModel } from "./companionModelResolver.js";

export type CompanionModelOperation = "respond" | "chat";
export type CompanionModelSource = ResolvedCompanionModel["source"] | "unresolved";

export function logCompanionModelFailure(
  error: unknown,
  operation: CompanionModelOperation,
  source: CompanionModelSource
): void {
  const value =
    typeof error === "object" && error !== null
      ? (error as { status?: unknown; code?: unknown })
      : {};
  const metadata: Record<string, unknown> = {
    operation,
    source,
    name: error instanceof Error ? error.name : "UnknownError"
  };
  if (typeof value.status === "number") metadata.status = value.status;
  if (typeof value.code === "string") metadata.code = value.code;
  console.warn("companion model failed", metadata);
}
