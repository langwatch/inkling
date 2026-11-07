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
};

export const MODE_NAMES = Object.keys(MODES);

/** Modes that sell or pitch: the copy rules bind hardest here. */
export const PITCH = ["ads", "deck", "investor"];
export const PROSE_MODES = ["docs", "post", "investor", "legal"];
export const ALL_BUT_LEGAL = ["docs", "post", "ads", "deck", "investor"];
