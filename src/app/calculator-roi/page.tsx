import type { Metadata } from "next";

import { CalculatorForm } from "@/app/calculator-roi/calculator-form";

export const metadata: Metadata = {
  title: "Calculator recuperare investiție",
  description:
    "Estimează economia de manoperă și recuperarea investiției într-o pompă Graco, pe cifrele lucrării tale.",
};

export default function CalculatorRoiPage() {
  return (
    <main>
      <CalculatorForm standalone />
    </main>
  );
}