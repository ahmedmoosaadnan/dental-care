# Security Specification - DentaSync

## Data Invariants
1. A **User Profile** must match the authenticated `request.auth.uid`.
2. All records (**Patients**, **Appointments**, **Treatments**, **Invoices**, **Inventory**) must have a `clinicId` that matches the user's `clinicId`.
3. Only `admin` roles can modify clinic settings or delete records.
4. Users cannot change their own `role` or `clinicId` once set.

## The "Dirty Dozen" Payloads (Deny Cases)
1. **Identity Theft**: Accessing `users/other_uid`.
2. **Clinic Leak**: Reading `patients` where `clinicId` != user's clinic.
3. **Privilege Escalation**: Updating `users/my_uid` with `role: 'admin'`.
4. **Shadow Write**: Creating a `patient` with an extra `isInsuranceFraud: true` field.
5. **ID Poisoning**: Using a 2KB string as a `patientId`.
6. **Orphaned Record**: Creating an `appointment` for a non-existent `patientId` (Relational Sync).
7. **Temporal Fraud**: Setting `createdAt` to a date in the past from the client.
8. **Role Spoofing**: Setting `clinicId` to a different clinic's ID during creation.
9. **Bulk Scrape**: Querying all `patients` without a `clinicId` filter.
10. **Terminal State Bypass**: Changing a `paid` invoice back to `unpaid`.
11. **PII Exposure**: Reading private user info (email) of other clinic staff without matching `clinicId`.
12. **Recursive Attack**: Deeply nested document ID injections.

## Test Runner (Logic)
- `tests/firestore.rules.test.ts` will verify these cases.
