/**
 * De ce s-a pierdut o ofertă: o listă scurtă, ca motivele să se poată număra
 * în raport. Aceleași coduri ca în constrângerea din baza de date.
 */
export const LOSS_REASONS = [
  { id: "pret", label: "Preț prea mare" },
  { id: "concurenta", label: "A cumpărat de la concurență" },
  { id: "amanat", label: "A amânat investiția" },
  { id: "finantare", label: "N-a obținut finanțare" },
  { id: "lucrari", label: "Nu are destule lucrări" },
  { id: "tehnic", label: "Utilajul nu se potrivește" },
  { id: "tacere", label: "Nu a mai răspuns" },
  { id: "altul", label: "Alt motiv" },
] as const;

export type LossReason = (typeof LOSS_REASONS)[number]["id"];

export const LOSS_REASON_IDS = LOSS_REASONS.map((r) => r.id) as [LossReason, ...LossReason[]];

export const lossReasonLabel = (id: string | null | undefined): string =>
  LOSS_REASONS.find((r) => r.id === id)?.label ?? "Motiv nenotat";
