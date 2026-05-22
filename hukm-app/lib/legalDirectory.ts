/**
 * HUKM — Static legal-resources directory.
 *
 * Hard rule: never fabricate contact details. If we don't have a verified
 * phone / email / website for a resource we set the field to `null` and
 * tell the user via the disclaimer to contact the relevant umbrella
 * institution.
 *
 * The set below intentionally avoids unverifiable specifics. The Bar
 * Association is the canonical referral point for finding licensed
 * advocates anywhere in Ethiopia, so generic "find an advocate" cards
 * route there.
 */

import type { CrimeCategory, LegalResource } from "./types";

export const LEGAL_DIRECTORY: ReadonlyArray<LegalResource> = [
  {
    name: "Federal Ethiopian Bar Association",
    type: "bar_association",
    specializations: ["referrals", "advocate_directory", "all_practice_areas"],
    city: "Addis Ababa",
    phone: null,
    email: null,
    website: null,
    languages: ["en", "am"],
    isFreeService: false,
    description:
      "Statutory body that licenses and regulates advocates across the federal courts. Use the bar association as the official starting point for finding a licensed advocate or filing a complaint about professional conduct.",
  },
  {
    name: "Ethiopian Women Lawyers Association (EWLA)",
    type: "legal_aid",
    specializations: [
      "gender_based_violence",
      "sexual_offense",
      "homicide",
      "assault",
      "family_law",
    ],
    city: "Addis Ababa",
    phone: null,
    email: null,
    website: null,
    languages: ["en", "am"],
    isFreeService: true,
    description:
      "Long-running legal-aid organisation that takes on cases involving gender-based violence and serious offences against women and children, often free of charge for indigent clients.",
  },
  {
    name: "Ethiopian Catholic Secretariat — Legal Aid",
    type: "legal_aid",
    specializations: ["legal_aid", "indigent_clients", "all_practice_areas"],
    city: "Addis Ababa",
    phone: null,
    email: null,
    website: null,
    languages: ["en", "am"],
    isFreeService: true,
    description:
      "Faith-based pro bono legal-aid programme that supports defendants who cannot afford private representation, irrespective of religion. Triages by need rather than case type.",
  },
  {
    name: "Federal First Instance Court — Public Defender",
    type: "court",
    specializations: ["criminal_defense", "appointed_counsel"],
    city: "Addis Ababa",
    phone: null,
    email: null,
    website: null,
    languages: ["am"],
    isFreeService: true,
    description:
      "Court-appointed defence is available to indigent defendants in serious criminal matters. Apply through the registry of the court hearing your case.",
  },
  {
    name: "Find a private criminal-defence advocate",
    type: "law_firm",
    specializations: ["criminal_defense", "general_practice"],
    city: "Nationwide",
    phone: null,
    email: null,
    website: null,
    languages: ["en", "am"],
    isFreeService: false,
    description:
      "If you can afford private counsel, contact the Federal Ethiopian Bar Association above for a verified list of licensed criminal-defence advocates in your region.",
  },
  {
    name: "Find a regional state bar association",
    type: "bar_association",
    specializations: ["referrals", "regional_practice"],
    city: "Regional",
    phone: null,
    email: null,
    website: null,
    languages: ["en", "am"],
    isFreeService: false,
    description:
      "Each regional state in Ethiopia has its own bar association. If your case is in regional courts, contact the bar association for that region directly.",
  },
  {
    name: "Pro bono legal clinics at law faculties",
    type: "legal_aid",
    specializations: ["legal_aid", "general_practice", "student_supervised"],
    city: "Multiple",
    phone: null,
    email: null,
    website: null,
    languages: ["en", "am"],
    isFreeService: true,
    description:
      "Several Ethiopian law faculties (Addis Ababa University, Bahir Dar, Mekelle, Hawassa) operate supervised legal-aid clinics. They take on civil and minor criminal matters subject to capacity.",
  },
];

interface RelevanceArgs {
  crimeCategory?: CrimeCategory | null;
  isCivilMatter?: boolean;
  /** Maximum results to return. Default 4. */
  limit?: number;
}

const EWLA_CATEGORIES: ReadonlySet<CrimeCategory> = new Set([
  "assault",
  "sexual_offense",
  "homicide",
]);

/**
 * Picks resources relevant to a particular case. Always returns the bar
 * association, EWLA only when the category warrants it, free services
 * first, capped at `limit`.
 */
export function getRelevantResources(
  args: RelevanceArgs = {},
): LegalResource[] {
  const limit = args.limit ?? 4;
  const wantEWLA =
    args.crimeCategory !== undefined &&
    args.crimeCategory !== null &&
    EWLA_CATEGORIES.has(args.crimeCategory);

  // Always include the bar association.
  const picked: LegalResource[] = [];
  const seen = new Set<string>();

  function add(r: LegalResource | undefined): void {
    if (!r) return;
    if (seen.has(r.name)) return;
    seen.add(r.name);
    picked.push(r);
  }

  add(LEGAL_DIRECTORY.find((r) => r.type === "bar_association"));

  if (wantEWLA) {
    add(LEGAL_DIRECTORY.find((r) => r.name.includes("Women Lawyers")));
  }

  // For civil matters, surface a free clinic next.
  if (args.isCivilMatter) {
    add(LEGAL_DIRECTORY.find((r) => r.name.includes("legal clinics")));
  }

  // Top up with remaining free services first, then paid.
  const remaining = LEGAL_DIRECTORY.filter((r) => !seen.has(r.name));
  remaining.sort((a, b) => Number(b.isFreeService) - Number(a.isFreeService));
  for (const r of remaining) {
    if (picked.length >= limit) break;
    add(r);
  }

  return picked.slice(0, limit);
}
