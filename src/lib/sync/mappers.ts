function ts(seconds?: number | null) {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

export function extractPhoneEmail(
  customFields?: Array<{
    field_code?: string;
    field_name?: string;
    values: Array<{ value: string | number }>;
  }>,
) {
  let phone: string | null = null;
  let email: string | null = null;

  for (const field of customFields || []) {
    const code = (field.field_code || "").toUpperCase();
    const name = (field.field_name || "").toLowerCase();
    const value = String(field.values?.[0]?.value ?? "");
    if (!value) continue;
    if (code === "PHONE" || name.includes("phone") || name.includes("tel")) {
      phone = value;
    }
    if (code === "EMAIL" || name.includes("email") || name.includes("correo")) {
      email = value;
    }
  }

  return { phone, email };
}

export function customFieldsToJson(
  customFields?: Array<{
    field_id: number;
    field_name?: string;
    values: Array<{ value: string | number | boolean }>;
  }>,
) {
  if (!customFields?.length) return null;
  return JSON.stringify(
    customFields.map((f) => ({
      field_id: f.field_id,
      field_name: f.field_name,
      values: f.values.map((v) => v.value),
    })),
  );
}

export function tagsToJson(tags?: Array<{ id: number; name: string; color?: string }>) {
  if (!tags?.length) return null;
  return JSON.stringify(tags);
}

export { ts };
