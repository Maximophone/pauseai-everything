import { NextRequest, NextResponse } from "next/server";
import {
  listContacts,
  createContact,
  validateCustomFields,
} from "@/lib/contacts";

// GET /api/contacts — list contacts with search, pagination, sorting
export async function GET(request: NextRequest) {
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
  const body = await request.json();

  const { email, firstName, lastName, customFields = {} } = body;

  if (!email && !firstName && !lastName) {
    return NextResponse.json(
      { error: "At least one of email, firstName, or lastName is required." },
      { status: 400 }
    );
  }

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
      email,
      firstName,
      lastName,
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
