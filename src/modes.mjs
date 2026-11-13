// Modes are starting points, not audiences. The audience is free text and picks the mind;
// a mode only sets which rules apply and a few limits. See docs/layers/f-modes.md.
export const MODES = {
  docs: {
    label: "product documentation: strictly technical, short paragraphs, no voice",
    paragraphWords: 80,
  },
  post: {
    label: "technical or founder post: an engineer writing to engineers, a person telling a story",
    paragraphWords: 70,
  },
  ads: {
    label: "marketing, ads, landing copy, titles: a business mind, lead with strengths, never concede",
    paragraphWords: 40,
  },
  landing: {
    label: "landing page: a story from the reader's search to the result, short problem text, a different visual per section, calls to action where they help. Pick the kind with --page or `page:` in the front matter",
    paragraphWords: 60,
    like: ["ads"],
    defaultPage: "ad",
    // Each kind of landing page has its own goal, reader and structure: docs/process/landing/.
    pages: {
      ad: {
        label: "ad landing page: a cold visitor from one search or ad, one pain, one promise",
        minWords: 700,
        minSections: 5,
        sectionsPerCta: 2,
        problemWords: 50,
        problemFirst: true,
      },
      home: {
        label: "the home page: every kind of visitor, the whole product, the most careful page on the site",
        minWords: 500,
        minSections: 5,
        sectionsPerCta: null,
        problemWords: 50,
        problemFirst: true,
      },
      product: {
        label: "product page: home-page care for one product, for a visitor who searched its category",
        minWords: 700,
        minSections: 5,
        sectionsPerCta: 2,
        problemWords: 50,
        problemFirst: true,
      },
      guide: {
        label: "guide or tutorial for search and ads: a visitor who wants to get a task done, taught step by step",
        minWords: 900,
        minSections: 4,
        sectionsPerCta: null,
        problemWords: 60,
        problemFirst: true,
      },
      job: {
        label: "page with one job: pricing, a comparison, the iceberg; a visitor who is already deciding",
        problemWords: 50,
        problemFirst: false,
      },
    },
  },
  deck: {
    label: "slides: few-word titles, at most three short bullets, narrative in speaker notes",
    paragraphWords: 30,
  },
  legal: {
    label: "order forms and terms: precise, nothing a lawyer has to guess",
    paragraphWords: 120,
  },
  investor: {
    label: "investor updates and decks: numbers with comparisons, no hype",
    paragraphWords: 60,
  },
  x: {
    label: "posts and replies on X: one claim, the scroller's mind, copy rules plus post rules",
    paragraphWords: 50,
    like: ["ads", "post"],
    firstBlockIsTitle: true,
  },
  script: {
    label: "spoken script: a narrated lesson or video, heard once, in order, with no headings",
    // A listener never sees a paragraph break, so the limit only stops a minute of talk with no breath.
    paragraphWords: 150,
    like: ["post"],
    wordsPerMinute: 150,
  },
};

export const MODE_NAMES = Object.keys(MODES);

/** A rule written for a mode also binds every mode that is `like` it. */
export const modeFamily = (mode) => [mode, ...(MODES[mode]?.like ?? [])];

export const pageNames = (mode) => Object.keys(MODES[mode]?.pages ?? {});

/** The landing kind a draft is: `--page`, then `page:` in the front matter, then the mode's default. */
export function pageOf({ mode, page, frontmatter = {} }) {
  const pages = MODES[mode]?.pages;
  if (!pages) return null;
  const kind = page ?? frontmatter.page?.value ?? MODES[mode].defaultPage;
  if (!pages[kind]) throw new Error(`unknown page kind ${kind} for mode ${mode}; one of ${Object.keys(pages).join(", ")}`);
  return kind;
}

/** A mode's limits with its page kind's on top. */
export const settingsOf = (mode, page) => ({ ...MODES[mode], ...(page ? MODES[mode].pages[page] : {}) });

/** Modes that sell or pitch: the copy rules bind hardest here. */
export const PITCH = ["ads", "landing", "deck", "investor"];
export const PROSE_MODES = ["docs", "post", "investor", "legal"];
export const ALL_BUT_LEGAL = ["docs", "post", "ads", "landing", "deck", "investor"];
