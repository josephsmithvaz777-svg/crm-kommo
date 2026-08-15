import { NextRequest, NextResponse } from "next/server";
import { contactScopeWhere, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { kommoApi } from "@/lib/kommo/client";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session && process.env.AUTH_SETUP_OPEN !== "true") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    phone?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };

  const contact = await prisma.contact.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(session ? contactScopeWhere(session) : {}),
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contacto no encontrado o sin permiso" }, { status: 404 });
  }

  const name = body.name?.trim() || contact.name;
  const phone =
    body.phone !== undefined ? (body.phone?.trim() || null) : contact.phone;
  const email =
    body.email !== undefined ? (body.email?.trim() || null) : contact.email;
  const firstName =
    body.firstName !== undefined
      ? body.firstName?.trim() || null
      : contact.firstName;
  const lastName =
    body.lastName !== undefined
      ? body.lastName?.trim() || null
      : contact.lastName;

  if (!name) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const custom_fields_values: Array<{
    field_code: string;
    values: Array<{ value: string; enum_code?: string }>;
  }> = [];

  if (body.phone !== undefined) {
    custom_fields_values.push({
      field_code: "PHONE",
      values: phone ? [{ value: phone, enum_code: "WORK" }] : [],
    });
  }
  if (body.email !== undefined) {
    custom_fields_values.push({
      field_code: "EMAIL",
      values: email ? [{ value: email, enum_code: "WORK" }] : [],
    });
  }

  let kommoWarning: string | undefined;
  try {
    await kommoApi.updateContact({
      id: contact.kommoId,
      name,
      ...(firstName !== undefined ? { first_name: firstName || "" } : {}),
      ...(lastName !== undefined ? { last_name: lastName || "" } : {}),
      ...(custom_fields_values.length ? { custom_fields_values } : {}),
    });
  } catch (error) {
    kommoWarning =
      error instanceof Error ? error.message : "Kommo rechazó la actualización";
  }

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data: {
      name,
      phone,
      email,
      firstName,
      lastName,
    },
    include: { company: true, responsible: true },
  });

  return NextResponse.json({
    contact: updated,
    ...(kommoWarning
      ? {
          warning: `Guardado en ConexiónCRM, pero Kommo falló: ${kommoWarning}`,
        }
      : {}),
  });
}
