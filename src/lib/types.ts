// Serialized types for passing data from server to client components
// Next.js serializes Date objects to ISO strings when crossing the boundary

export type SerializedContact = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SerializedFieldDefinition = {
  id: string;
  name: string;
  label: string;
  fieldType: string;
  options: string[] | null;
  sortOrder: number | null;
  createdAt: string;
};
