/** Datele de identificare ale firmei, comune formularului de firmă nouă și editării de pe teren. */
export type CompanyData = {
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  cui: string | null;
  reg_com: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
};

type Field = {
  name: keyof CompanyData;
  label: string;
  type?: "tel" | "email";
  placeholder?: string;
  inputMode?: "numeric";
};

// Perechile stau pe același rând și pe telefon, ca formularul să nu fie prea lung.
const ROWS: Field[][] = [
  [{ name: "name", label: "Nume firmă / meseriaș *" }],
  [{ name: "contact_person", label: "Persoană de contact", placeholder: "Nume și prenume" }],
  [
    { name: "phone", label: "Telefon", type: "tel" },
    { name: "email", label: "Email", type: "email" },
  ],
  [
    { name: "cui", label: "CUI", placeholder: "RO12345678" },
    { name: "reg_com", label: "Nr. Reg. Com. (J)", placeholder: "J12/345/2020" },
  ],
  [{ name: "address", label: "Adresă", placeholder: "Stradă, număr" }],
  [
    { name: "city", label: "Localitate" },
    { name: "county", label: "Județ" },
  ],
];

export function CompanyFields({ defaults, idPrefix = "" }: { defaults?: CompanyData; idPrefix?: string }) {
  return (
    <>
      {ROWS.map((row) => (
        <div key={row[0].name} className="flex gap-3">
          {row.map((f) => (
            <div key={f.name} className="min-w-0 flex-1">
              <label className="label" htmlFor={`${idPrefix}${f.name}`}>
                {f.label}
              </label>
              <input
                id={`${idPrefix}${f.name}`}
                name={f.name}
                type={f.type ?? "text"}
                required={f.name === "name"}
                autoComplete="off"
                placeholder={f.placeholder}
                defaultValue={defaults?.[f.name] ?? ""}
                className="input"
              />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
