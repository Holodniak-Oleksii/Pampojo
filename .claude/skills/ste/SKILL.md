---
name: ste
description: Pampojo's Simplified Technical English rules, adapted from ASD-STE100. Use every time you write English text in this repo, such as docs, specs, scratch plans, ADRs, DECISIONS.md, code comments, commit messages, PR descriptions, test names, error messages and English UI copy. Also use it to check or rewrite such text.
---

# Simplified Technical English (STE)

Pampojo's English follows a short version of ASD-STE100. The goal is text that has one meaning, that a non-native reader understands on the first read, and that a machine translates without errors.

These rules apply to all new English text. Do not rewrite old text unless the lead asks, or unless you already change that paragraph.

Do not apply them to code identifiers, quoted text (logs, errors from libraries, user input), Ukrainian strings, product names, or copy that a spec gives word for word.

## 1. Words

1. Use common words. Prefer the short word: `use`, not `utilize`; `start`, not `initiate`; `help`, not `facilitate`. See the table in section 7.
2. One word has one meaning. Do not use `run` for "execute" in one place and for "workout session" in another.
3. One thing has one name. Use the name that `docs/tech/DATA_MODEL.md`, the specs and the code already use (`workout`, `session`, `set`, `plan`, `gym profile`). Do not use a synonym for variety.
4. Use a word only as the part of speech it is. Do not turn nouns into verbs (`to action`, `to impact`) or verbs into nouns (`an ask`, `the build-out`).
5. Use technical names as they are: `service worker`, `outbox`, `Zod schema`, `idempotency key`. A technical name may break rule 1.
6. Do not use phrasal verbs that have many meanings (`set up`, `get over`, `put off`, `come up with`). Use one verb: `configure`, `recover`, `delay`, `find`. A phrasal verb that is a fixed technical term is OK (`log in`, `sign up`, `roll back`).
7. Do not use slang, idioms, jokes or metaphors (`out of the box`, `under the hood`, `low-hanging fruit`, `bake in`).
8. Spell out an abbreviation the first time in a document, unless it is common in this repo (`API`, `PWA`, `UI`, `URL`, `DB`, `CI`, `E2E`).

## 2. Noun clusters

1. Do not put more than three nouns in a row.
   - Bad: `workout session set log retry handler`.
   - Good: `the handler that retries the set log of a workout session`.
2. If a long cluster is a technical name, explain it once, then use it as the name.

## 3. Verbs

1. Use the active voice. Say who or what does the action.
   - Bad: `The set is saved to the outbox.`
   - Good: `The client saves the set to the outbox.`
   - The passive voice is OK only in descriptive text when the actor is not important.
2. Use only these tenses: simple present, simple past, simple future (`will`), and the imperative.
   - Bad: `The worker has been caching pages.` Good: `The worker caches pages.`
3. Do not use `-ing` forms as a verb or after a preposition.
   - Bad: `Before saving the set, check…` Good: `Before you save the set, check…`
   - An `-ing` word is OK as a technical name (`rate limiting`, `runtime caching`) or as an adjective (`the remaining sets`).
4. Do not use `should`, `may` or `might` for rules. Use `must` for a requirement and `can` for an option. `may` is OK only for a possibility (`the request may fail`).

## 4. Sentences

1. One sentence gives one idea or one instruction.
2. Maximum length: 20 words in an instruction, 25 words in a description. Count every word, including articles. Code spans count as one word.
3. Use articles (`a`, `the`) and `that` where English needs them. Do not drop them to save words.
   - Bad: `Check user exists before write.` Good: `Make sure that the user exists before the write.`
4. Do not use a semicolon or a long dash to join two sentences. Write two sentences.
5. Use parallel structure in lists. Every item starts with the same part of speech.
6. Use a vertical list when a sentence has more than three items or more than one condition.

## 5. Instructions and procedures

This covers skills, scratch plans, guides in `docs/development/`, review checklists and test steps.

1. Write one instruction as one imperative sentence: `Run pnpm typecheck.`
2. Put one action in one step. Two actions at the same time are OK in one step (`Hold the button and drag.`).
3. Put a condition first: `If the spec has no Design section, stop.` Not: `Stop if the spec has no Design section.`
4. Put a warning or a caution before the step it applies to, not after.
5. Number the steps when their order is important. Use bullets when it is not.
6. Give the result of a step as a separate sentence: `Run pnpm db:migrate. The new column appears in the sets table.`

## 6. Descriptions

This covers specs, ADRs, architecture docs, comments, commits and PR descriptions.

1. Put the most important information first. Then give the details.
2. One paragraph has one topic and a maximum of six sentences.
3. Give a reason with a separate sentence that starts with a clear word: `This is necessary because…`, `The reason is…`. In a comment, one short `because` clause is OK.
4. Be specific. Give numbers, names and limits, not `some`, `a few`, `fast`, `large`.
   - Bad: `API calls were slow.` Good: `API calls with transactions took 1–3 s.`
5. A commit subject is one imperative sentence of a maximum of 72 characters, with no full stop: `Add the history calendar to Today`.

## 7. Words to replace

| Do not use | Use |
| --- | --- |
| utilize, leverage | use |
| initiate, commence | start |
| terminate | stop, end |
| facilitate, enable (someone to) | help, let |
| in order to | to |
| prior to | before |
| subsequent to | after |
| due to the fact that | because |
| in the event that | if |
| at this point in time | now |
| a number of | some, or give the number |
| ensure | make sure |
| perform (a check) | do, or use the verb: `check` |
| make use of | use |
| approximately | about |
| sufficient | enough |
| additional | more |
| obtain, acquire | get |
| require | need (`must` for a rule) |
| via | through, with |
| e.g., i.e., etc. | for example, that is, or a full list |
| simply, just, easily, obviously | omit |
| basically, actually, really, very | omit |

## 8. Check before you finish

Read the new text again before you write it to a file, a commit or a PR. Make sure that:

1. No sentence is longer than the limit in section 4.
2. No word from the table in section 7 is in the text.
3. Every verb is in the active voice and in an allowed tense, or it has a reason to be different.
4. The text uses the same name for the same thing every time.
5. A reader who does not know the code understands each sentence without the next one.

If a rule makes a sentence less clear, keep the clear sentence. Clarity is the goal. The rules are the method.
