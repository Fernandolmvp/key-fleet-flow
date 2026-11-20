# Architecture rules
- Keep automatic overdue/settlement statuses in shared read-only presentation helpers; retain stored workflow statuses for editing and explicit actions to prevent reads from modifying historical records.
- Use the local calendar day, refreshed at midnight and on focus, for deadline-based presentation rules so today's deadlines never expire early.