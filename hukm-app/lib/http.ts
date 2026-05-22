/**
 * HUKM — HTTP helpers shared by API routes.
 *
 * Centralises the JSON-error envelope so every endpoint speaks the same
 * dialect ({ success: false, error, code? }). Plain-text error responses
 * are forbidden by the spec.
 */

import { NextResponse } from "next/server";

import type { ApiErrorResponse } from "./types";

export function jsonError(
  status: number,
  error: string,
  code?: string,
  extraHeaders?: Record<string, string>,
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = { success: false, error };
  if (code) body.code = code;
  return NextResponse.json(body, {
    status,
    headers: extraHeaders,
  });
}
