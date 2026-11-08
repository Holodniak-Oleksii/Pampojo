# 23. AI exercise tagging

## Goal

Creating a custom exercise is quicker: the user types a name, AI suggests muscles, pattern, equipment, mechanic and tracking type.

## Scope

- In the custom exercise form (spec 07), after the name: "Suggest tags" (online only).
- Output restricted to the allowed constant values; prefilled fields are highlighted as suggestions until the user accepts or edits them.
- Evals on a labelled set of 40+ exercises; metrics: primary muscle precision, pattern accuracy.

## Acceptance criteria

- [ ] AC1: Suggested values are always from the allowed lists.
- [ ] AC2: Nothing is saved until the user saves the form.
- [ ] AC3: Evals meet the thresholds set in drill.

## Depends on

07, 20.
