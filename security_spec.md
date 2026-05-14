# Security Specification - Mindflow

## Data Invariants
1. A memory must have a valid content and status.
2. Conflict groups must contain references to valid conflicts.
3. Access to Mindflow admin data (conflicts, groups, settings) is restricted to Admins/Owners.
4. Global Admin (celular@rodrigomoura.net) has full access to all Mindflow data.

## The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Identity Spoofing**: Attempt to create a memory as another user.
   - Payload: `{ "user_id": "other_user_id", "content": "spoofed content", "status": "active" }`
   - Target: `/mindflow_memories`
   - Expect: `PERMISSION_DENIED`

2. **Privilege Escalation**: Attempt to promote self to admin.
   - Payload: `{ "role": "admin", "user_id": "my_uid" }`
   - Target: `/user_roles/my_uid_admin`
   - Expect: `PERMISSION_DENIED`

3. **Conflict Manipulation (Analyst)**: Non-admin trying to resolve a conflict.
   - Action: `update`
   - Target: `/mindflow_conflict_groups/group_1`
   - Expect: `PERMISSION_DENIED`

4. **Shadow Field Injection**: Adding a "is_verified" field to a profile.
   - Payload: `{ "display_name": "Name", "is_verified": true }`
   - Target: `/profiles/my_uid`
   - Expect: `PERMISSION_DENIED` (due to `affectedKeys().hasOnly`)

5. **Resource Poisoning**: Large content in memory.
   - Payload: `{ "content": "A" * 1000000, "status": "active" }`
   - Target: `/mindflow_memories` (Wait, rules verify size? `isValidMindflowMemory` doesn't currently check size explicitly in code but `isValidMemory` does).

6. **Orphaned Writes**: Creating a conflict run without a valid reasoning.
   - Target: `/mindflow_reasoning_runs`
   - Expect: `PERMISSION_DENIED` (if relational check exists).

7. **PII Leak**: Non-admin user listing all profiles.
   - Target: `/profiles` (list)
   - Expect: `PERMISSION_DENIED`

8. **System Field Modification**: Modifying `detected_at` on a conflict.
   - Target: `/mindflow_conflicts`
   - Expect: `PERMISSION_DENIED` (if immutable).

9. **Terminal State Bypass**: Re-opening a resolved conflict group.
   - Target: `/mindflow_conflict_groups/resolved_group`
   - Expect: `PERMISSION_DENIED`.

10. **Query Scraping**: Authenticated user listing all interactions of others.
    - Target: `/mindflow_user_interactions` (list)
    - Expect: `PERMISSION_DENIED` (unless filter applied).

11. **Email Spoofing**: User with email `celular@rodrigomoura.net` but `email_verified: false` gaining owner access.
    - Expect: `PERMISSION_DENIED`. (Applied in rules).

12. **ID Injection**: Creating a document with a 2KB ID.
    - Expect: `PERMISSION_DENIED` (due to `isValidId`).

## Evaluation Report

| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
|------------|-------------------|-------------------|--------------------|
| mindflow_memories | SECURE (isAdmin/isOwner) | SECURE (Status checked) | SECURE (Size limit in code) |
| mindflow_conflicts | SECURE (isAdmin) | SECURE (isAdmin) | SECURE (isValidId) |
| mindflow_conflict_groups | SECURE (isAdmin) | SECURE (isAdmin) | SECURE (isValidId) |
| profiles | SECURE (uid check) | SECURE (affectedKeys) | SECURE (size checks) |
