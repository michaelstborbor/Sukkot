import { TransitionError } from "@sukkot/shared";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYMENT_PROVIDER"
  | "NOT_CONFIGURED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYMENT_PROVIDER: 502,
  NOT_CONFIGURED: 501,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
  get status() {
    return STATUS[this.code];
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`);
export const forbidden = (msg = "You do not have permission to do that") => new AppError("FORBIDDEN", msg);
export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Please sign in to continue");

export function zodFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/** Normalise any thrown value into an AppError, never leaking internals. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) return new AppError("VALIDATION", "Please check the highlighted fields", zodFields(err));
  if (err instanceof TransitionError) {
    return new AppError(err.code === "NOT_ALLOWED" ? "FORBIDDEN" : "CONFLICT", err.message);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return new AppError("CONFLICT", "That record already exists");
    if (err.code === "P2025") return new AppError("NOT_FOUND", "Record not found");
  }
  console.error("[unhandled]", err);
  return new AppError("INTERNAL", "Something went wrong. Please try again.");
}
