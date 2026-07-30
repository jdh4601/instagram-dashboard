# Open-source readiness audit

This document records repository-level risks that are easy to miss when publishing a formerly
personal project. It intentionally contains no live account identifiers, credentials, or private
URLs.

## Implemented safeguards

- MIT license, contribution guide, security policy, issue links, Dependabot, and CI
- fictional demo fixtures and screenshot
- owner-only credential file permissions and secret-free backups
- fail-closed partial Basic Auth configuration
- production dependency audit in CI
- JSON, SQLite, and PostgreSQL analytics storage adapters behind one Repository contract
- Instagram OAuth state validation and server-side long-lived token exchange

## History findings

The current tree did not contain a high-confidence live Instagram token, LLM key, email API key,
private key, or JWT. Historical commits still contain personal metadata that an owner may want to
remove:

- generated assistant session URLs in commit trailers
- a personal author/committer email address
- a former real account handle in an old test revision
- an absolute local development path and an old personal launchd identifier
- operational metrics in some commit bodies

These are privacy findings, not active credential findings. Rewriting public history changes every
affected commit ID and requires a force-push, so it must be an explicit repository-owner decision.
It also cannot erase existing forks, caches, or clones.

On 2026-07-30, the replacement plan below was exercised in a temporary mirror: `git fsck` passed
and the targeted old email, session trailer, handle, path, and launchd identifier had zero remaining
matches. The temporary mirror was deleted and no remote ref was changed.

## Safe rewrite procedure

1. Freeze merges and create a mirror backup.
2. Use `git filter-repo` in a fresh mirror clone, never in the working copy.
3. Replace the personal email with the owner's GitHub noreply address.
4. Remove generated session trailers and sensitive commit bodies.
5. Replace the historical handle/path/launchd identifier using a redaction mapping kept outside
   the repository.
6. Re-run secret scanning over every branch and tag.
7. Review the rewritten refs and only then force-push with repository-owner approval.
8. Ask collaborators to make a fresh clone.

If a real secret is ever found, revoke and rotate it first. History rewriting is not secret
rotation.

## Remaining product constraints

- Basic Auth is suitable for one trusted operator, not multi-user accounts or roles.
- `settings.json` is encrypted by filesystem permissions, not application-level encryption.
- SQLite needs a persistent disk and one application host; use PostgreSQL for shared deployments.
- Meta may require App Review/Advanced Access before non-tester Instagram accounts can connect.
- The UI is primarily Korean; extracting copy into an i18n layer would improve global adoption.
- Real Graph API behavior is not exercised in CI because it would require a live account token.
