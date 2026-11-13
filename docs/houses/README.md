# Houses

Put one company's product names, figure components, audience words and site-only review notes in its house.

Inkling's process, rules and reader tests stay the same for every company; the house adds the parts that differ.

A house is two things:

- a page here, `docs/houses/<name>.md`, that an agent reads after the process step it names;
- optional rules in `rules/house-<name>.mjs`, each marked `house: "<name>"`, which run only with `--house <name>`.

Add a house for your company the same way. Keep the core pages free of it: when a lesson only holds for one company's site or product, it goes in that house, and the core page says what kind of thing the house supplies ("the components to build mocks from").
