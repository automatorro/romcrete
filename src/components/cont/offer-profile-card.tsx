import { saveMySignature, saveOrgStamp } from "@/components/cont/actions";
import { ImagePicker } from "@/components/cont/image-picker";
import { OfferProfileForm } from "@/components/cont/offer-profile-form";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const dataUri = (mime: string | null | undefined, b64: string | null | undefined) =>
  mime && b64 ? `data:${mime};base64,${b64}` : null;

/**
 * Ce pune fiecare agent pe ofertele lui: numele, telefonul, emailul și
 * semnătura. Conducerea vede aici și ștampila firmei.
 */
export async function OfferProfileCard() {
  const { orgId, user, role } = await requireOrg();
  const supabase = await createClient();
  const [{ data: me }, { data: org }] = await Promise.all([
    supabase
      .from("memberships")
      .select("full_name, phone, contact_email, signature_mime, signature_b64")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle(),
    role === "agent"
      ? Promise.resolve({ data: null })
      : supabase.from("organizations").select("stamp_mime, stamp_b64").eq("id", orgId).maybeSingle(),
  ]);

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-4 md:p-6">
        <div>
          <h2 className="text-base font-semibold">Datele mele pe ofertă</h2>
          <p className="text-sm text-neutral-500">
            Apar la „Reprezentant companie” pe fiecare ofertă pe care o faci, iar semnătura, la final, lângă ștampilă.
          </p>
        </div>
        <OfferProfileForm
          fullName={me?.full_name ?? null}
          phone={me?.phone ?? null}
          email={me?.contact_email ?? null}
          loginEmail={user.email}
        />
        <div className="border-t border-neutral-200 pt-4">
          <p className="label">Semnătura mea</p>
          <ImagePicker
            current={dataUri(me?.signature_mime, me?.signature_b64)}
            save={saveMySignature}
            label="Semnătura"
            removeLabel="Scoate semnătura"
            hint="O poză cu semnătura pe hârtie albă sau un PNG cu fundal transparent. Se micșorează singură."
          />
        </div>
      </section>

      {role === "agent" ? null : (
        <section className="card space-y-3 p-4 md:p-6">
          <div>
            <h2 className="text-base font-semibold">Ștampila firmei</h2>
            <p className="text-sm text-neutral-500">Apare pe toate ofertele, lângă semnătura agentului care le face.</p>
          </div>
          <ImagePicker
            current={dataUri(org?.stamp_mime, org?.stamp_b64)}
            save={saveOrgStamp}
            label="Ștampila"
            removeLabel="Scoate ștampila"
            hint="Cel mai bine un PNG cu fundal transparent, ca să nu acopere semnătura."
          />
        </section>
      )}
    </div>
  );
}
