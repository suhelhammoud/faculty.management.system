# Curriculum fixture sources

The source files are the supplied University of Homs curriculum PDFs. The seed uses the committed TypeScript transcriptions and needs no PDF files at runtime.

| Curriculum                | Source                                    | Interpretation                                                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy Curriculum (v1)    | `old.pdf`, pages 1–4                      | Page 1 supplies the common Years 1–3. Pages 2, 3, and 4 supply Years 4–5 for Software Engineering and Information Systems, Networks and Computer Systems, and Artificial Intelligence, respectively. The legacy source has no stated academic year. |
| Curriculum 2025–2026 (v2) | `new.pdf`, cover and pages 3, 5, 7, and 9 | The three full tables supply the department schedules. Article 9 supplies the grading rule for modules with practical work. Article 11 supplies the graduation project grading rule.                                                                |

The first semester is on the right in the legacy tables and above the second in the revised tables. Transcription follows each semester's row order. The Arabic course numbers were checked visually and use Western digits in the fixtures. The English names are translations, and the generated `Y1-S1-01` style codes identify a row within a version. The source tables supply no credits or elective designations, so credits are null and the listed modules are required.

Weekly hours come from the theory and practical cells on the module rows. Dashes and empty hours cells on populated rows mean zero. In revised Artificial Intelligence Year 2, Semester 1, Databases I has a dash in its practical hours cell. The rows sum to 8 practical hours, while the printed subtotal says 10. The seed uses 8, the sum of the individual rows.

Legacy rows with separate marks use their printed 70 theory and 30 practical marks. A merged 100-mark cell records a total without allocating marks to theory or practical. Revised modules with a practical component use the 70/30 rule, except graduation projects. For a revised graduation project, both semester rows reference the same scheme of 100 total marks with 30 for project progress. These are project totals across the academic year. Revised theory-only rows leave grading unspecified where the source gives no marks.

The version titles retain their catalog labels. Legacy descriptions identify each specialization, and remarks explain the shared Years 1–3. The revised descriptions identify the 2025–2026 internal regulations, and the remarks record the phased rollout in Article 12. Neither source supplies an exact adoption date or a ministry decision reference. Those fields start blank.

The command creates missing departments by stable code, preserves existing department settings, and inserts published versions with stable IDs. On rerun it verifies matching records and fills missing descriptions and remarks. Existing values, publication dates, and student assignments are preserved. A conflict rolls back the transaction.
