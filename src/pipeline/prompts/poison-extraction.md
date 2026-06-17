# Poison extraction spec (2024)

Convert the D&D 2024 **poison** table — scraped from dnd2024.wikidot.com as Markdown in
`data/md/poison/poison.md` — into one structured JSON record **per table row**, written to
`data/out/poison/<slug>.json`. Extract only what the table states; never invent values.

The page is mostly rules prose; the only data is the **"Sample Poisons"** table (cols:
Poison, Type, Cost, Effect). Skip everything else (the Contact/Ingested/Inhaled/Injury
type definitions, Purchasing, Harvesting).

Schema: `src/pipeline/schemas/poison-2024.ts`. Validate after with `npm run validate poisons`.

## How a subagent runs

For each data row in the Sample Poisons table, **using Claude Sonnet**, produce the JSON object
below and write it to `data/out/poison/<index>.json` (pretty-printed, trailing newline). Skip a
row whose output already exists. Output **only** the JSON object — no prose, no fences.

## Field rules

- **name** — the Poison cell, verbatim, with curly quotes/apostrophes normalized to ASCII
  (`Assassin’s Blood` → `Assassin's Blood`).
- **index** — kebab-case of the name: lowercase, spaces → hyphens, drop apostrophes/punctuation
  (`Assassin's Blood` → `assassins-blood`; `Lolth's Sting` → `lolths-sting`).
- **type** — the Type cell with the trailing ` Poison` stripped and lowercased:
  `Ingested Poison` → `ingested`; `Inhaled Poison` → `inhaled`; `Contact Poison` → `contact`;
  `Injury Poison` → `injury`.
- **cost** — `"<n> GP"` → `{ "quantity": <n>, "unit": "gp" }`; strip commas (`1,500 GP` →
  `{ "quantity": 1500, "unit": "gp" }`).
- **desc** — the Effect cell as a single-element array of one string. Strip Markdown emphasis,
  normalize curly quotes/apostrophes to ASCII.
- **url** — `/api/2024/poisons/<index>`.

## Worked example

Row: `| Assassin’s Blood | Ingested Poison | 150 GP | A creature subjected to Assassin’s Blood makes a DC 10 Constitution saving throw. ... |`

```json
{
  "index": "assassins-blood",
  "name": "Assassin's Blood",
  "type": "ingested",
  "cost": { "quantity": 150, "unit": "gp" },
  "desc": [
    "A creature subjected to Assassin's Blood makes a DC 10 Constitution saving throw. On a failed save, the creature takes 6 (1d12) Poison damage and has the Poisoned condition for 24 hours. On a successful save, the creature takes half as much damage only."
  ],
  "url": "/api/2024/poisons/assassins-blood"
}
```
