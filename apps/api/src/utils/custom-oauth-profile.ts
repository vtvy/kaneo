import { isHttpUrl } from "./is-http-url";

const MAX_PICTURE_URL_LENGTH = 2048;

export const MANAGED_PROFILE_FIELDS = ["name", "image"] as const;

export type ManagedProfileField = (typeof MANAGED_PROFILE_FIELDS)[number];

function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS lists the profile fields the custom
 * provider owns ("name", "image"). The email is never synced: it identifies
 * the person for invitations and account linking.
 */
export function parseManagedProfileFields(
  raw = process.env.CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS,
): ManagedProfileField[] {
  const fields = new Set<string>();
  for (const entry of (raw ?? "").split(",")) {
    const field = entry.trim().toLowerCase();
    if (!field) continue;
    if (!(MANAGED_PROFILE_FIELDS as readonly string[]).includes(field)) {
      throw new Error(
        `CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS accepts name and image, not "${entry.trim()}".`,
      );
    }
    fields.add(field);
  }
  return MANAGED_PROFILE_FIELDS.filter((field) => fields.has(field));
}

export function readCustomOAuthPicture(profile: Record<string, unknown>) {
  const picture = stringOrEmpty(profile.picture);
  if (picture.length > MAX_PICTURE_URL_LENGTH || !isHttpUrl(picture)) {
    return null;
  }
  const { href } = new URL(picture);
  return href.length <= MAX_PICTURE_URL_LENGTH ? href : null;
}

/** The display name from standard OIDC claims, with sensible fallbacks. */
export function readCustomOAuthName(profile: Record<string, unknown>) {
  const email = stringOrEmpty(profile.email);
  const nameFromParts = [
    stringOrEmpty(profile.given_name),
    stringOrEmpty(profile.family_name),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    [
      stringOrEmpty(profile.name),
      nameFromParts,
      stringOrEmpty(profile.preferred_username),
      email ? email.split("@")[0] : "",
    ].find(Boolean) ?? null
  );
}

export function mapCustomOAuthProfileToUser(profile: Record<string, unknown>) {
  const name = readCustomOAuthName(profile);
  return name ? { name } : {};
}

/** The account id Better Auth links the provider account with. */
export function readCustomOAuthAccountId(profile: Record<string, unknown>) {
  for (const value of [profile.id, profile.sub]) {
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

export function planManagedProfileUpdate(
  profile: Record<string, unknown>,
  stored: { name: string; image: string | null },
  fields: readonly ManagedProfileField[],
) {
  const update: { name?: string; image?: string } = {};
  if (fields.includes("name")) {
    const name = readCustomOAuthName(profile);
    if (name && name !== stored.name) update.name = name;
  }
  if (fields.includes("image")) {
    const picture = readCustomOAuthPicture(profile);
    if (picture && picture !== stored.image) update.image = picture;
  }
  return update;
}
