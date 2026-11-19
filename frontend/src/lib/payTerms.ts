export type PayTerm = "COD" | "30D" | "45D";

export const payTermLabels: Record<PayTerm, string> = {
  COD: "COD",
  "30D": "Net 30",
  "45D": "Net 45",
};
