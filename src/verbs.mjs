// Small word lists the rules share to tell events, states and time from each other.
const IRREGULAR_PAST =
  "wrote said told came ran sent built made found took gave went saw got left paid lost won bought sold thought knew felt put kept brought began chose drove fell held led meant met spoke spent stood taught threw understood woke broke shipped hit";
const STATE = new Set("was were had seemed felt looked sounded remained stayed became".split(" "));
const PAST = new Set(IRREGULAR_PAST.split(" "));

/** A past-tense action verb: an event, not a state. */
export const isPastAction = (w) => {
  const word = w.toLowerCase();
  if (STATE.has(word)) return false;
  return PAST.has(word) || (/^[a-z]{3,}ed$/.test(word) && !/(?:need|speed|seed|feed|bleed)$/.test(word));
};

/** The first verb-like word of a clause is a copula or modal, as in a definition. */
export const COPULA = /^(?:is|are|was|were|has|have|had|can|could|may|might|must|should|will|would|means|mean|needs|need|does|do)$/;

/** Words that move the clock in a narrative. */
export const TIME_MARKER =
  /\b(?:morning|afternoon|evening|night|midnight|noon|monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|today|tomorrow|later|then|next|after|before|minutes?|hours?|days?|weeks?|by \d|at \d)\b/i;

/** Nouns for people and organisations, the usual undefined subjects. */
export const PERSON_NOUN =
  /^(?:founders?|developers?|engineers?|users?|customers?|clients?|teams?|compan(?:y|ies)|businesses|business|organi[sz]ations?|enterprises?|startups?|managers?|directors?|leaders?|executives?|buyers?|marketers?|colleagues?|teammates?|people|person|folks|readers?|analysts?|designers?|ops)$/i;
