"use server";

import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { organizationSchema, parseForm, type ActionState } from "@/lib/validation";

export async function updateOrganization(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId } = await requireOrg();

  const parsed = parseForm(organizationSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update(parsed.data).eq("id", orgId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Datele firmei au fost salvate." };
}
