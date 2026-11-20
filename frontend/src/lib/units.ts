// The five units the product table allows (unit_ck check on product.unit), with a readable label.
export type Unit = "pc" | "ea" | "mtr" | "pkg" | "ltr";

export const unitLabels: Record<Unit, string> = {
  pc: "Piece (pc)",
  ea: "Each (ea)",
  mtr: "Meter (mtr)",
  pkg: "Package (pkg)",
  ltr: "Liter (ltr)",
};

export const unitOptions = Object.keys(unitLabels) as Unit[];
