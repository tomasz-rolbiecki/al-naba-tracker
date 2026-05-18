# Editorial data

Each file in this folder is one al-Naba editorial summary.

- **Filename:** `<issue_number>.json` (e.g. `500.json`).
- **Format:** JSON with the schema shown below.
- **Adding:** click "Add file" → "Create new file" in this folder on GitHub, name it after the issue number, paste the JSON output from the al-naba-analyser skill, commit.
- **Editing:** open the file, click the pencil icon, edit, commit.
- **Deleting:** open the file, click the trash bin icon, commit.

After any commit on the main branch, the tracker rebuilds and redeploys automatically. Changes appear in 1 to 2 minutes.

## Schema

```json
{
  "issueNumber": 500,
  "publicationDate": "2026-04-23",
  "title": "Editorial title in English translation",
  "summary": "Analytical summary, 150 to 250 words.",
  "themes": ["theme-one", "theme-two"],
  "geographicFocus": ["Iraq", "Syria"],
  "groupsMentioned": ["PKK", "Hashd al-Shaabi"],
  "individualsMentioned": ["al-Sistani"],
  "keyClaims": ["First claim", "Second claim"],
  "significanceAssessment": "Two to three sentences on analytical significance.",
  "confidence": "high",
  "notes": "",
  "manualNotes": "Any analyst observations added after the initial analysis."
}
```

All fields except `issueNumber` are optional. Lists can be empty arrays. The tracker tolerates missing fields and renders what is present.
