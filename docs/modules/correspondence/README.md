# Correspondence System

## Purpose

Registers and tracks incoming and outgoing official correspondence.

The Diwan uses this module to register incoming, outgoing, and internal correspondence, follow referrals and delivery, and retrieve copies and receipt evidence. The initial scope proposed by the source is an internal staff workflow in the shared university application. It records endorsements and signatures made on paper. A student portal, online submissions, electronic signatures, automated dispatch, text recognition, and direct integrations with the Presidency or Ministry are later possibilities subject to review. The Diwan records documents about matters such as leave or maintenance. The authority responsible for the matter makes the underlying decision.

This is a candidate specification for Diwan and faculty review. **Interview basis** identifies working practices or needs derived from the interview (E01–E07). **Proposed** identifies automation, policy, and design choices still to be reviewed. [Diwan requirements and use cases](../../resources/diwan_requirements_use_cases_English.docx)

## Actors and access

| Actor | Proposed boundary |
| --- | --- |
| Diwan clerk | Registers documents, attaches files, records referrals and delivery, classifies records, and searches within assigned access. |
| Diwan supervisor | Has clerk duties plus separately authorized corrections, cancellations, and extended reporting. |
| Authorized reader or report user | Searches, downloads, or prints only within the approved record and entity scope. |
| System administrator or designated operator | Handles assigned settings and recovery tasks. Account administration alone grants no document access. |
| Head of Administration and Dean | Provide endorsements and referral instructions on paper. Diwan staff record those actions. |
| Courier, recipients, and external entities | Deliver or receive documents outside the app in the initial scope. Diwan staff record handover and receipt. |

Use shared sign-in, accounts, roles, and authorization. Correspondence defines the actions and record scopes that need permission. Proposed server checks apply to search, files, direct links, API calls, and reports. Recipient entities can be recorded without creating user accounts for them. Data exchange with other modules remains open. [Shared identity and access](../../identity-and-access.md)

## Business rules from the Diwan interview

- Record the sender's reference number and date in fields separate from the faculty registration number. Retain both references without substituting one for the other. [Diwan interview analysis, E02 and BR-02](../../resources/diwan_requirements_use_cases_English.docx)
- A document may be distributed to multiple recipient entities. Track delivery and receipt status and evidence separately for each entity. One recipient's acknowledgment updates only its own record. Overall distribution remains incomplete while any other recipient is awaiting acknowledgment. [Diwan interview analysis, E03 and BR-01, BR-05, BR-06](../../resources/diwan_requirements_use_cases_English.docx)

## Workflows and data rules

### Registration and references

- **Interview basis (E01, E02, E04, E07).** For incoming documents, record the sending entity, its reference and date where present, arrival date, subject, content, and attachments. For outgoing documents, record the issue date, destination, immediate receiving entity, and the copy retained by the Diwan. A reply may link to the incoming record. Keep outgoing registration separate from external delivery. Record internal correspondence by direction and type. A circular or announcement identifies its addressees and stays distinct from directed correspondence.
- **Proposed.** Drafts receive an official number on confirmed registration. Generate a unique number within the approved numbering scope, including under concurrent registration. Flag a possible duplicate sender reference for review. Keep the official number reserved after cancellation. Annual resets, register splits, formats, mandatory fields, and handling missing references need review.

### Images, attachments, and custody

- **Interview basis (E02, E05).** Link the document image and supporting files to the relevant record, referral, or delivery. Track the paper attachment count separately from digital files. Distinguish the Diwan's retained copy from distributed copies and the paper original. Track one current holder and location for the original, and record transfers of the original and accompanying attachments.
- **Proposed.** Record file role and version, validate size and type, and preserve earlier versions within the applicable access and retention rules. Confirm when a missing image can be recorded with a reason.

### Paper referrals and delivery

- **Interview basis (E02, E03).** Record the endorsing official, date, instructions, intended entities, and paper evidence when available. Keep successive referrals visible. Each delivery item identifies its recipient entity, what it receives, handover details, and any receipt or return. Record the recipient, date, and evidence for a receipt. If delivery is refused, record the return and its reason and leave the item incomplete.
- **Interview basis (E04).** The described external route is courier delivery through the University Presidency. Link the external delivery list to the outgoing records, record courier handover and the Presidency's receipt for each item, and retain the Diwan copy. Receipt by the Presidency confirms that leg only. Final destination receipt needs separate evidence.
- **Proposed.** Document why evidence is missing and apply the policy agreed with the Diwan before treating an item as received. Review direct dispatch exceptions and how they should be recorded.

### Classification, search, and reporting

- **Interview basis (E05–E07).** Record the archive classification and paper location. Keep reclassification history and allow filing while delivery follow-up is still open. Let authorized users retrieve records by faculty number or sender reference and search by subject, entity, date, or classification.
- **Proposed.** Provide printable incoming, outgoing, delivery, and outstanding receipt lists with authorized filters, counts, and per-recipient status. Agree on the initial lists and fields before scheduling extended reports.

### Corrections, settings, and recovery

- **Proposed.** Require permission and a reason for correction or cancellation. Preserve the registration number, prior values, linked records, and receipt evidence. The audit trail records who changed what and when. Ordinary users cannot edit it.
- **Proposed.** Let authorized staff manage entities, types, classifications, and numbering settings while preserving historical references. Disable entities that are no longer used and retain their earlier links. Back up records and files and verify restored evidence links and access permissions in an isolated environment.

## Proposed lifecycle

- **Registration and referral:** Draft → Registered → Awaiting paper endorsement if needed → Ready for distribution. Registration can be completed before referral and delivery.
- **Each delivery item:** Prepared → Handed to courier → Received or Returned. An authorized cancellation records a reason.
- **Overall distribution:** Derive not distributed, partially distributed, or fully delivered from the active recipient items. Follow-up closure is a separate authorized action. Archiving and cancellation have their own meanings. Confirm closure and reopening conditions with the Diwan.

## Source mapping

| Area | Functional requirements | Use cases | Acceptance scenarios |
| --- | --- | --- | --- |
| Shared access and module settings | FR-01, FR-02, FR-03, FR-24 | UC-13 | AT-06, AT-07 |
| Incoming registration and files | FR-04, FR-05, FR-06, FR-07, FR-17 | UC-01, UC-02 | AT-01, AT-06, AT-07 |
| Referrals, distribution, receipt, and custody | FR-08, FR-09, FR-10, FR-18, FR-22 | UC-03, UC-04, UC-05 | AT-02 |
| Outgoing registration and Presidency delivery | FR-05, FR-07, FR-10, FR-11, FR-12 | UC-06, UC-07 | AT-03, AT-06 |
| Internal correspondence and circulars | FR-13, FR-14 | UC-08 | AT-04 |
| Classification and retrieval | FR-15, FR-16, FR-17 | UC-09, UC-10 | AT-05, AT-07 |
| Correction and audit | FR-19, FR-20 | UC-11, UC-13 | AT-06, AT-07 |
| Lists and reports | FR-21 | UC-12 | AT-08 |
| Backup and recovery | FR-23 | UC-14 | AT-09 |

## Candidate acceptance checks

Use sample records and review the scenarios with Diwan staff and the academic supervisor.

- **AT-01** Register and reopen an incoming record with a sender reference and date, a separate faculty number, a paper attachment count, and a digital image.
- **AT-02** Refer a document to two entities. Verify one current original holder, separate receipt records, partial distribution after the first receipt, and completion after the second valid receipt. Incomplete receipt data leaves the affected item pending.
- **AT-03** Record two receipts on a Presidency list of three documents. The third remains pending, the Diwan copies remain retrievable, and the final destination needs separate confirmation.
- **AT-04** Register directed internal correspondence and a circular. Both retain their types and intended addressees without creating external records.
- **AT-05** Retrieve a document by either reference and by classification. Reclassify it while preserving history, original location, and delivery status.
- **AT-06** Confirm concurrent registration preserves unique numbers and avoids partial records. Cancellation reserves the number and keeps the audit history. Reject deletion of a linked entity and preserve earlier links if it is disabled.
- **AT-07** Deny unauthorized record or file access through direct links and API requests. Confirm shared account disablement and audit sensitive permission changes and corrections.
- **AT-08** Compare a list filtered by period, direction, and status with the register. Verify counts, the issue date, permission boundaries, and readable Arabic printouts.
- **AT-09** Restore a sample backup in isolation and verify record and file counts, evidence links, and access permissions.

### Proposed quality targets

The source offers graduation-project targets for review. Confirm the workload, environment, and operating thresholds before using them for acceptance.

| Source | Candidate target or control |
| --- | --- |
| NFR-01, NFR-09 | Arabic right-to-left layout and readable printed lists in two agreed desktop browsers. Check a three-minute ordinary registration target across five scenarios, excluding scanning. |
| NFR-02, NFR-03 | At 10,000 records and 10 concurrent users, 95% of searches within two seconds excluding downloads. For 20 concurrent registrations in one numbering scope, successful records have distinct numbers and failures leave no partial data. |
| NFR-04, NFR-05 | Server-side checks for records and attachments. Review encrypted connections, login logging, rate limiting, and password protection with the shared identity foundation. |
| NFR-06, NFR-07 | Daily backup, up to 24 hours of data loss, and recovery within four hours in an exercise. Proposed configurable upload limits are 20 MB per file and 100 MB per document for PDF, JPG, and PNG. |
| NFR-08, NFR-10 | Keep authorization independent of interfaces, document operations and recovery, and check numbering, receipt, and access rules. Use consistent timestamps displayed in the faculty's time zone and preserve audit and record consistency when an operation fails. |

## Decisions for Diwan review

- **Q01–Q02:** Confirm official register names and fields, numbering scopes, annual resets, and formats.
- **Q03–Q05:** Confirm the Presidency route and exceptions, who may endorse or correct, cancel, close, or reopen records, which participants need app access, and how to handle receipt evidence, refusals, and missing proof.
- **Q06–Q07:** Agree on classifications, folder codes, original storage locations, retention, correspondence types, forms, required attachments, and the boundary for request decisions and online submissions.
- **Q08–Q10:** Agree on operating volumes and quality targets, historical record migration and reconciliation, and who owns backups, authorizes restoration, and sets retention.
