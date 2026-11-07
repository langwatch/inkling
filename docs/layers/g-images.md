# Layer (g): images

Images get the same treatment as words: a vague prompt gives a generic picture, and a precise prompt gives the one you meant, from the same model. This page holds the prompt pattern behind the images reviewers approved, with real prompts.

## The pattern

1. **A fixed style block, the same on every prompt of a set.** Palette with hex values, what to avoid, how text looks. It keeps a deck or a post series consistent.
2. **A single scene, read left to right.** Pick the single idea the slide or post is about and describe it as objects in a row.
3. **Exact counts and exact labels.** "About 53 blocks" drew too many; "exactly 6 rows of 9 blocks (54, not more), exactly 13 orange blocks in rows of 4, 4 and 5, blocks large so the count is readable" came out right. Quote every word that may appear and say no other text.
4. **A style reference image with no text in it.** Send it to the edits endpoint as the first image. Text-only prompts drift to flat stock art.
5. **Masked edits for small fixes.** To remove one element, crop, mask a rectangle, edit, and paste back with a feathered edge. The rest of the picture stays as it was.
6. **Make two or three candidates, then look.** Open each one at full size, check every count and every letter, and drop any that is off style.

Words inside images follow the same rules as prose: no aphorism pairs, no hook typeset large, and the banned words still apply. For a translated deck, every image with words gets regenerated.

## The call

`tools/images/edit.py` (copied from the Laze mascot tool) calls the OpenAI images edit endpoint through the LangWatch AI Gateway with a gateway virtual key:

```sh
python3 tools/images/edit.py out/logo "<prompt>" 2 style-reference.png [composition-reference.png]
```

The model is `gpt-image-2.5-flare` at 1024x1024 with a transparent background. Landscape covers use 1536x1024.

## Real prompts

**Deck style block**, appended to every slide prompt of a talk:

> clean editorial flat illustration, like a premium tech-magazine infographic. Warm off-white #FAFAF7, near-black slate #14181F, one accent burnt orange #E2774A, soft greys. Lots of empty space. No heavy gradients, no 3D kitsch, no glowing neon, no stock robots with blue eyes. Any text must be short, sans-serif, spelled exactly as given.

The second round of that deck sent a first-round image as the style reference: "Match the style of the reference illustration exactly: flat hand-drawn line art, thin black outlines, cute simple blob characters with dot eyes, no text."

**Product page illustration** (one idea, exact counts, no text):

> A minimalist, flat vector editorial illustration for a software product page. Landscape orientation, generous negative space, calm and premium feel. Warm off-white cream background, roughly #F5F3EE, soft subtle shadows, no dark high-tech gradient. Muted, restrained palette: neutral warm greys with two small accents, a warm coral orange and a soft sky blue. Absolutely no purple, no violet, no magenta. [...] Absolutely no text, no title, no words, no letters, no numbers, no labels, no captions anywhere in the image. The composition tells one left-to-right story: a large, perfectly regular grid of small identical rounded rectangles in light warm grey fills the frame with a comfortable margin around it, every rectangle carrying one tiny soft green check mark in its centre, none skipped and none empty; about one rectangle in twenty is instead filled solid warm coral orange with a tiny white check mark.

**The proof icon**, with the siesta icon as the style reference:

> Character and render style: copy EXACTLY the reference image, a 3D plush toy sloth with soft dense felt fur you can see every fibre of, a smooth pale cream face mask, dark brown teardrop eye patches, small glossy black bead eyes with a tiny white highlight, a small dark brown oval nose, soft pink blush on the cheeks, a tiny calm smile, long cream curved claws (three per paw), chunky rounded grown-up body, soft studio lighting with gentle shading. [...] Scene: the plush sloth sits upright, holding a chunky red pen in one paw over a single sheet of cream paper resting on its lap; the paper shows a few soft grey lines of text and one big green tick mark [...]. A small rounded yellow fabric tag is stitched to the paper's edge, like the tag on the reference hammock, and the tag reads exactly "PROOF" in bold dark letters. No other text, no logos.

Of the two candidates, the one with a fully red pen won, and the other drew a green tip.

## What reviewers rejected

Images that look fake or 3D where a flat illustration was asked for, diagrams drawn in HTML instead of generated, purple palettes, and a rhetorical question set large in a serif instead of a picture.

## Next

`proof image-check` will read a prompt file before any call and flag a missing style block, counts written as "about", quoted text without "no other text", and banned words inside quoted labels.
