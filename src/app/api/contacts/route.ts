import { NextRequest, NextResponse } from "next/server";
import {
  listContacts,
  createContact,
  validateCustomFields,
} from "@/lib/contacts";
import { validateBody } from "@/lib/api-validate";
import { CreateContactInput } from "@/lib/schemas";
import { checkAuth, requireAuth, requireMember } from "@/lib/api-auth";

// GET /api/contacts — list contacts with search, pagination, sorting
export async function GET(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireAuth(authResult);
  if (authError) return authError;
  const searchParams = request.nextUrl.searchParams;

  const result = await listContacts({
    page: Number(searchParams.get("page")) || 1,
    pageSize: Number(searchParams.get("pageSize")) || 50,
    search: searchParams.get("search") || undefined,
    sortBy: searchParams.get("sortBy") || undefined,
    sortOrder:
      (searchParams.get("sortOrder") as "asc" | "desc") || undefined,
  });

  return NextResponse.json(result);
}

// POST /api/contacts — create a contact
export async function POST(request: NextRequest) {
  const authResult = await checkAuth(request);
  const authError = requireMember(authResult);
  if (authError) return authError;
  const body = await request.json();
  const parsed = validateBody(CreateContactInput, body);
  if (!parsed.success) return parsed.error;

  const { email, firstName, lastName, customFields } = parsed.data;

  // Validate custom fields if provided
  if (Object.keys(customFields).length > 0) {
    const validation = await validateCustomFields(customFields);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed.", details: validation.errors },
        { status: 400 }
      );
    }
  }

  try {
    const contact = await createContact({
      email: email ?? undefined,
      firstName: firstName ?? undefined,
      lastName: lastName ?? undefined,
      customFields,
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    // Handle unique constraint violation on email
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "A contact with this email already exists." },
        { status: 409 }
      );
    }
    throw err;
  }
}
