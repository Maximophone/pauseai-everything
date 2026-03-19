import { NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; error: NextResponse };

/**
 * Parse and validate a request body against a Zod schema.
 * Returns the parsed data on success, or a formatted error NextResponse on failure.
 */
export function validateBody<T>(
  schema: ZodSchema<T>,
  body: unknown
): ValidationSuccess<T> | ValidationFailure {
  const result = schema.safeParse(body);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const details = formatZodErrors(result.error);
  const message = details.length === 1 ? details[0] : "Validation failed.";

  return {
    success: false,
    error: NextResponse.json(
      {
        error: message,
        ...(details.length > 1 && { details }),
      },
      { status: 400 }
    ),
  };
}

/**
 * Parse and validate query/search params against a Zod schema.
 */
export function validateParams<T>(
  schema: ZodSchema<T>,
  params: Record<string, string | undefined>
): ValidationSuccess<T> | ValidationFailure {
  return validateBody(schema, params);
}

/**
 * Convert null values to undefined in an object (for compatibility with
 * Partial<T> function signatures that don't accept null).
 */
export function stripNulls<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], null> | undefined } {
  const result = { ...obj } as Record<string, unknown>;
  for (const key in result) {
    if (result[key] === null) {
      result[key] = undefined;
    }
  }
  return result as { [K in keyof T]: Exclude<T[K], null> | undefined };
}

function formatZodErrors(error: ZodError): string[] {
  return error.issues.map((e) => {
    if (e.path.length > 0) {
      return `${e.path.join(".")}: ${e.message}`;
    }
    return e.message;
  });
}
