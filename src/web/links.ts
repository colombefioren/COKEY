/**
 * Project identity in one place.
 *
 * The dashboard, the tutorial and the contact card all point at the same
 * person and the same repository, so the strings live here rather than being
 * retyped on every page.
 */

export const REPO_URL = "https://github.com/colombefioren/COKEY";

export const CREATOR = {
  name: "colombefioren",
  github: "https://github.com/colombefioren",
  linkedin: "https://www.linkedin.com/in/colombefioren",
  facebook: "https://www.facebook.com/colombe.fioren",
} as const;

/** Where the model data behind the rankings came from. */
export const DATA_CREDIT = {
  label: "awesome-free-byok-models",
  url: "https://github.com/velo4705/awesome-free-byok-models",
} as const;
