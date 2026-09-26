export const cmToFtIn = (cm: number) => {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - ft * 12);
  if (inches === 12) { ft += 1; inches = 0; }
  return { ft, inches };
};
export const ftInToCm = (ft: number, inches: number) => Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
export const kgToLb = (kg: number) => Math.round(kg * 2.20462 * 10) / 10;
export const lbToKg = (lb: number) => Math.round((lb / 2.20462) * 10) / 10;

export const formatHeight = (cm: number, system: string) => {
  if (system !== "imperial") return `${cm} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}′${inches}″`;
};
export const formatWeight = (kg: number, system: string) =>
  system === "imperial" ? `${kgToLb(kg)} lb` : `${kg} kg`;
