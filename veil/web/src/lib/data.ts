// Small local datasets for persona generation. Intentionally generic so that
// generated personas are plausible but not tied to any real individual.

export const FIRST_NAMES = [
  "Avery", "Riley", "Jordan", "Casey", "Morgan", "Quinn", "Skyler", "Rowan",
  "Emerson", "Finley", "Harper", "Reese", "Sawyer", "Kendall", "Elliot",
  "Marlowe", "Dakota", "Hayden", "Peyton", "Arden", "Blake", "Sage",
  "Tatum", "Wren", "Lennon", "Ellis", "Remy", "Kai", "Nova", "Sasha",
];

export const LAST_NAMES = [
  "Hale", "Vance", "Ashby", "Marsh", "Cole", "Reyes", "Nolan", "Frost",
  "Barlow", "Quill", "Sloan", "Meade", "Dorsey", "Kerr", "Pruitt", "Voss",
  "Ainsley", "Beckett", "Calloway", "Deverell", "Ellison", "Fairchild",
  "Grimes", "Holloway", "Ingram", "Larkin", "Mercer", "Okafor", "Rhodes",
  "Sterling",
];

export const STREETS = [
  "Cedar", "Maple", "Juniper", "Larkspur", "Sycamore", "Aspen", "Birch",
  "Willow", "Marigold", "Sable", "Clover", "Foxglove", "Heather", "Ivy",
  "Laurel", "Sorrel", "Thistle", "Bramble", "Fern", "Rowanberry",
];

export const STREET_TYPES = ["St", "Ave", "Ln", "Dr", "Ct", "Way", "Ter", "Pl"];

export const CITIES: Array<{ city: string; state: string; zipPrefix: string }> = [
  { city: "Austin", state: "TX", zipPrefix: "787" },
  { city: "Portland", state: "OR", zipPrefix: "972" },
  { city: "Denver", state: "CO", zipPrefix: "802" },
  { city: "Columbus", state: "OH", zipPrefix: "432" },
  { city: "Raleigh", state: "NC", zipPrefix: "276" },
  { city: "Boise", state: "ID", zipPrefix: "837" },
  { city: "Madison", state: "WI", zipPrefix: "537" },
  { city: "Tucson", state: "AZ", zipPrefix: "857" },
];

// Reserved-for-documentation TLD (RFC 2606) so aliases can never collide with
// a real domain when this runs without a configured forwarding provider.
export const DEFAULT_ALIAS_DOMAIN = "relay.veil.example";

export const IDENTITY_COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];
