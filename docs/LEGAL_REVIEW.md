# Legal review required before launch

The software was written by engineers, not lawyers. Everything below must be reviewed by a lawyer
qualified in Sierra Leone before the platform takes real users or money.

## Pages and notices

- `/terms`, `/privacy` and `/refunds` are **drafts** and are labelled as such on the site. `/takedown`
  describes the takedown process and the review times we aim for (2 working days).
- Shared notices in `packages/shared/src/legal.ts` (offer not a legal transfer, verification limits,
  viewing safety, payment honesty, no escrow, rental terms, demo content).
- Due-diligence checklist template (`DUE_DILIGENCE_TEMPLATE` in the same file): confirm it reflects
  current practice for title searches, survey plans and registration in the Western Area and the
  provinces, including customary land outside Freetown.

## Questions for counsel

1. **Agency and brokerage**: does listing on behalf of owners, or charging agents for subscriptions and
   promotion, require registration or a licence? Which records must agents hold to list a property?
2. **Data protection**: the platform stores identity documents, phone numbers and messages. Confirm
   lawful basis, retention periods, cross-border transfer (cloud hosting outside Sierra Leone) and how
   users exercise access and deletion rights.
3. **Payments**: confirm that collecting subscription and promotion fees through Orange Money and
   Afrimoney merchant accounts needs no further Bank of Sierra Leone authorisation, and that recording
   (not collecting) rent and sale payments keeps the platform outside payment-service rules.
4. **Tenancy rules**: limits on advance rent and deposits, and required lease terms. The app lets
   landlords propose advance rent periods and deposits; it shows a warning but does not enforce limits.
5. **Offers**: confirm that the "agreement in principle" wording prevents an accepted offer from being
   treated as a binding contract.
6. **Verification**: confirm the wording of each badge (what it means and does not mean) limits
   liability adequately.
7. **Content moderation and disputes**: notice-and-takedown process, ownership disputes, and law
   enforcement requests.
8. **Consumer protection**: refunds for subscriptions, promotions, inspection visits and extra listing
   slots, as set out in the draft `/refunds` page (including the 14-day visit promise and 7 working
   days to pay a refund back).
9. **Tax**: whether platform fees attract GST and how receipts must be issued.
