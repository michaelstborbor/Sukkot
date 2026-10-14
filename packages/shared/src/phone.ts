/**
 * Sierra Leone phone numbers: country code +232, 8-digit national significant number,
 * written locally with a leading 0 (e.g. 076 123 456 → +232 76 123456).
 * Operator prefixes are configurable because they change over time.
 */
export const SL_COUNTRY_CODE = "232";

export const SL_MOBILE_PREFIXES: Record<string, string> = {
  "25": "Sierratel",
  "30": "Africell",
  "31": "Qcell",
  "32": "Qcell",
  "33": "Africell",
  "34": "Qcell",
  "44": "Sierratel",
  "66": "Orange",
  "72": "Orange",
  "73": "Orange",
  "74": "Orange",
  "75": "Orange",
  "76": "Orange",
  "77": "Africell",
  "78": "Orange",
  "79": "Orange",
  "80": "Africell",
  "88": "Africell",
  "90": "Africell",
  "99": "Africell",
};

/** Normalise to E.164 (+232XXXXXXXX). Returns null if the input is not a plausible Sierra Leone number. */
export function normalizeSlPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let national: string;
  if (digits.startsWith("+232")) national = digits.slice(4);
  else if (digits.startsWith("00232")) national = digits.slice(5);
  else if (digits.startsWith("232") && digits.length === 11) national = digits.slice(3);
  else if (digits.startsWith("0")) national = digits.slice(1);
  else national = digits;
  if (!/^\d{8}$/.test(national)) return null;
  if (!/^[2-9]/.test(national)) return null;
  return `+${SL_COUNTRY_CODE}${national}`;
}

export function phoneOperator(e164: string): string | null {
  const m = /^\+232(\d{2})\d{6}$/.exec(e164);
  return m ? (SL_MOBILE_PREFIXES[m[1]!] ?? null) : null;
}

/** "+23276123456" → "+232 76 123 456" */
export function formatSlPhone(e164: string): string {
  const m = /^\+232(\d{2})(\d{3})(\d{3})$/.exec(e164);
  return m ? `+232 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

/** Mask all but the last three digits, for showing contact numbers before disclosure. */
export function maskPhone(e164: string): string {
  return e164.replace(/\d(?=\d{3})/g, (d, i: number) => (i < 4 ? d : "•"));
}
