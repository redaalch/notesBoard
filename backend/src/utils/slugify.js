const SLUG_SEPARATOR = "-";

const DEFAULT_OPTIONS = {
  separator: SLUG_SEPARATOR,
  lower: true,
  maxLength: 80,
};

const ACCENT_MAP = new Map(
  Object.entries({
    À: "A",
    Á: "A",
    Â: "A",
    Ã: "A",
    Ä: "A",
    Å: "A",
    Æ: "AE",
    Ç: "C",
    È: "E",
    É: "E",
    Ê: "E",
    Ë: "E",
    Ì: "I",
    Í: "I",
    Î: "I",
    Ï: "I",
    Ñ: "N",
    Ò: "O",
    Ó: "O",
    Ô: "O",
    Õ: "O",
    Ö: "O",
    Ø: "O",
    Œ: "OE",
    Ù: "U",
    Ú: "U",
    Û: "U",
    Ü: "U",
    Ý: "Y",
    Þ: "TH",
    ß: "ss",
    à: "a",
    á: "a",
    â: "a",
    ã: "a",
    ä: "a",
    å: "a",
    æ: "ae",
    ç: "c",
    è: "e",
    é: "e",
    ê: "e",
    ë: "e",
    ì: "i",
    í: "i",
    î: "i",
    ï: "i",
    ñ: "n",
    ò: "o",
    ó: "o",
    ô: "o",
    õ: "o",
    ö: "o",
    ø: "o",
    œ: "oe",
    ù: "u",
    ú: "u",
    û: "u",
    ü: "u",
    ý: "y",
    þ: "th",
    ÿ: "y",
  })
);

const normalizeAccents = (value) =>
  value
    .split("")
    .map((char) => ACCENT_MAP.get(char) ?? char)
    .join("");

const sanitize = (value) =>
  normalizeAccents(value)
    .replace(/[^a-zA-Z0-9\s_-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

export default function slugify(value, options = {}) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const config = { ...DEFAULT_OPTIONS, ...options };
  const sanitized = sanitize(value);
  const words = sanitized.split(" ").filter(Boolean);
  let slug = words.join(config.separator);

  if (config.lower) {
    slug = slug.toLowerCase();
  }

  if (config.maxLength && slug.length > config.maxLength) {
    slug = slug.slice(0, config.maxLength);
  }

  return slug;
}
