import { createLowlight } from "lowlight";
import type { LanguageFn } from "highlight.js";
import plaintext from "highlight.js/lib/languages/plaintext";

const lowlight = createLowlight();

// Register plaintext eagerly (tiny). Other languages load on demand.
lowlight.register({ plaintext });

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  md: "markdown",
  html: "xml",
};

type HljsLanguageModule = { default: LanguageFn };

const loadingLanguages = new Map<string, Promise<HljsLanguageModule>>();
const loadedLanguageModules = new Map<string, HljsLanguageModule>();

/**
 * Lazily registers a highlight.js language grammar.
 * Safe to call multiple times — skips if already registered or loading.
 */
export async function registerLanguage(name: string): Promise<void> {
  const canonical = LANGUAGE_ALIASES[name] ?? name;

  if (loadingLanguages.has(canonical)) {
    try {
      const mod = await loadingLanguages.get(canonical);
      if (mod && name !== canonical && !lowlight.registered(name)) {
        lowlight.register(name, mod.default);
      }
    } catch {
      // ignore
    }
    return;
  }

  if (lowlight.registered(canonical)) {
    if (name !== canonical && !lowlight.registered(name)) {
      const existing = loadedLanguageModules.get(canonical);
      if (existing) {
        lowlight.register(name, existing.default);
      } else {
        try {
          const mod = await import(
            /* @vite-ignore */ `highlight.js/lib/languages/${canonical}`
          );
          loadedLanguageModules.set(canonical, mod);
          lowlight.register(name, mod.default);
        } catch {
          // ignore
        }
      }
    }
    return;
  }

  const loadPromise = import(
    /* @vite-ignore */ `highlight.js/lib/languages/${canonical}`
  ) as Promise<HljsLanguageModule>;
  loadingLanguages.set(canonical, loadPromise);

  try {
    const mod = await loadPromise;
    loadedLanguageModules.set(canonical, mod);
    lowlight.register(canonical, mod.default);
    // Also register the original name as alias if different
    if (name !== canonical) {
      lowlight.register(name, mod.default);
    }
  } catch {
    // Unsupported language — fall back to plaintext
  } finally {
    loadingLanguages.delete(canonical);
  }
}

// Pre-register common languages in the background (non-blocking)
const PRELOAD_LANGUAGES = [
  "javascript",
  "typescript",
  "css",
  "json",
  "python",
  "bash",
  "sql",
  "xml",
  "markdown",
];

if (typeof window !== "undefined") {
  // Use requestIdleCallback to load common languages without blocking
  const load = () => {
    PRELOAD_LANGUAGES.forEach((lang) => registerLanguage(lang));
    // Register aliases after the canonical names
    Object.entries(LANGUAGE_ALIASES).forEach(([alias]) =>
      registerLanguage(alias),
    );
  };

  const win = window as Window & {
    requestIdleCallback?: (cb: () => void) => number;
  };
  if (win.requestIdleCallback) {
    win.requestIdleCallback(load);
  } else {
    setTimeout(load, 100);
  }
}

export default lowlight;
