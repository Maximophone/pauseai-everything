import { NextRequest, NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/users";
import { checkAuth, requireAdmin } from "@/lib/api-auth";
import { validateBody } from "@/lib/api-validate";
import { CreateApiKeyInput } from "@/lib/schemas";

// GET /api/api-keys — list API keys (admin only)
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const keys = await listApiKeys();

  // Don't expose key hashes
  const safeKeys = keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    userId: k.userId,
    isActive: k.isActive,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  }));

  return NextResponse.json(safeKeys);
}

// POST /api/api-keys — create a new API key (admin only)
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const adminError = requireAdmin(authResult);
  if (adminError) return adminError;

  const body = await request.json();
  const parsed = validateBody(CreateApiKeyInput, body);
  if (!parsed.success) return parsed.error;

  const result = await createApiKey(authResult.userId!, parsed.data.name);

  return NextResponse.json(
    {
      id: result.id,
      name: result.name,
      keyPrefix: result.keyPrefix,
      rawKey: result.rawKey, // Only returned once!
      createdAt: result.createdAt,
    },
    { status: 201 }
  );
}
