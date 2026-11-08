# 14. Body measurements and BMI

## Goal

Users track weight and body measurements over time and see their BMI, tucked into Profile rather than the main screen.

## Scope

- `body_measurement` endpoints (table exists since spec 04).
- Profile:
  - BMI card: value, WHO category label, horizontal scale, weight trend mini chart, last updated;
  - measurements list: latest value per type and change since the previous one;
  - Add measurement sheet: type, value, date (default today); several types in one go.
- `/profile/measurements/[type]`: history chart and list with edit/delete.
- Units follow the profile setting.
- BMI copy notes it is a rough indicator for adults.

## Out of scope

Body photos, body-fat calculators.

## Acceptance criteria

- [ ] AC1: Adding weight updates the BMI card immediately; BMI = kg / m² rounded to one decimal.
- [ ] AC2: Category labels follow WHO adult ranges; the boundaries are unit tested.
- [ ] AC3: Changes show with an up/down indicator and sign.
- [ ] AC4: Editing or deleting a measurement updates the history and the latest value.
- [ ] AC5: Without a height or weight, the BMI card asks for the missing value.
- [ ] AC6: Same add request twice creates one measurement.

## Depends on

04.
