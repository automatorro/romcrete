"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, firstIssue, type ActionState } from "@/lib/validation";

function readCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Email sau parolă greșite"
          : error.message,
    };
  }

  const redirectTo = String(formData.get("redirectTo") ?? "").trim();
  revalidatePath("/", "layout");
  if (redirectTo.startsWith("/")) redirect(redirectTo);

  // Agentul lucrează pe teren, conducerea la birou: fiecare ajunge direct unde trebuie.
  const { data: user } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.user?.id ?? "")
    .maybeSingle();

  redirect(membership?.role === "agent" ? "/teren" : "/oferte");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);

  if (error) return { error: error.message };

  // Dacă proiectul Supabase cere confirmarea emailului, nu există încă sesiune.
  if (!data.session) {
    return {
      success:
        "Ți-am trimis un email de confirmare. Deschide linkul din email, apoi intră în cont.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
