// Modes are starting points, not audiences. The audience is free text and picks the mind;
// a mode only sets which rules apply and a few limits. See docs/layers/f-modes.md.
export const MODES = {
  docs: {
    label: "product documentation: strictly technical, short paragraphs, no voice",
    paragraphWords: 80,
  },
  post: {
    label: "technical or founder post: an engineer writing to engineers, a person telling a story",
    paragraphWords: 80,
  },
  ads: {
    label: "marketing, ads, landing copy, titles: a business mind, lead with strengths, never concede",
    paragraphWords: 40,
  },
  landing: {
    label: "landing page for cold search or ad traffic: a story from the search to the result, a product mock per claim, calls to action along the page, enough real content on the topic to rank",
    paragraphWords: 60,
    like: ["ads"],
    minWords: 700,
    minSections: 5,
    sectionsPerCta: 2,
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

/** Modes that sell or pitch: the copy rules bind hardest here. */
export const PITCH = ["ads", "landing", "deck", "investor"];
export const PROSE_MODES = ["docs", "post", "investor", "legal"];
export const ALL_BUT_LEGAL = ["docs", "post", "ads", "landing", "deck", "investor"];
