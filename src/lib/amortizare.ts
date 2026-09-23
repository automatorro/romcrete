/**
 * Calculul de amortizare: în cât se plătește singură pompa, pe cifrele meseriașului.
 *
 * E argumentul care mută discuția de la „e scumpă” la „când o iau”. De aceea
 * fiecare ipoteză e explicită și schimbabilă din Setări, nu ascunsă în cod:
 * randamentul mecanizat față de manual și zilele lucrate pe lună sunt ale firmei,
 * nu ale mele.
 */

export type PaybackInput = {
  /** Metri pătrați pe zi, acum — din intervalul bifat la „Suprafață pe zi”. */
  mpPerDay: number | null;
  /** Lei pe metru pătrat — din intervalul bifat la „Cât ia pe mp”. */
  leiPerMp: number | null;
  productivityFactor: number;
  workingDaysPerMonth: number;
  /** Prețul fără TVA al pompei discutate. */
  pumpPrice: number | null;
  /** A refuzat lucrări: true = are cerere, false = nu, null = nu s-a aflat. */
  hasDemand: boolean | null;
};

export type Payback = {
  mpNow: number;
  mpMechanised: number;
  extraMpPerDay: number;
  extraLeiPerDay: number;
  extraLeiPerMonth: number;
  /** Luni până se plătește pompa. Null dacă nu s-a ales niciun model. */
  months: number | null;
  /**
   * Calculul presupune că are de lucru cât să umple capacitatea în plus.
   * Dacă a spus că nu refuză lucrări, presupunerea e falsă și trebuie spus.
   */
  demandWarning: boolean;
};

const round = (n: number, zecimale = 0) => {
  const f = 10 ** zecimale;
  return Math.round(n * f) / f;
};

/** Null când lipsește oricare dintre cele două cifre fără care nu există calcul. */
export function computePayback(input: PaybackInput): Payback | null {
  const { mpPerDay, leiPerMp, productivityFactor, workingDaysPerMonth, pumpPrice } = input;
  if (!mpPerDay || !leiPerMp || productivityFactor <= 1 || workingDaysPerMonth <= 0) return null;

  const mpMechanised = round(mpPerDay * productivityFactor);
  const extraMpPerDay = round(mpMechanised - mpPerDay);
  const extraLeiPerDay = round(extraMpPerDay * leiPerMp);
  const extraLeiPerMonth = round(extraLeiPerDay * workingDaysPerMonth);

  return {
    mpNow: mpPerDay,
    mpMechanised,
    extraMpPerDay,
    extraLeiPerDay,
    extraLeiPerMonth,
    months:
      pumpPrice && extraLeiPerMonth > 0 ? round(pumpPrice / extraLeiPerMonth, 1) : null,
    demandWarning: input.hasDemand === false,
  };
}

/** „Are cerere?” din răspunsul la „A refuzat lucrări”. */
export function demandFrom(refuzat: unknown): boolean | null {
  if (refuzat === "des" || refuzat === "cateva") return true;
  if (refuzat === "nu") return false;
  return null;
}
