# Security and Privacy Notes

## Remediation made in this package

The original Birth Chart source included a hard-coded Telegram bot credential and silently sent a message containing birth details, coordinates, timezone, and a generated report to a remote Telegram endpoint after chart creation. That automatic transmission block and the credential were removed from this organized package.

## Required action outside this package

The original credential has already been present in the uploaded source, so removing it from this ZIP cannot make the old credential safe again. Revoke/rotate that bot token through the official Telegram bot-management flow, and review the destination account and any reports already received. If real users' data was sent, assess what was retained and who could access it.

## Remaining review needed before public release

- Review all external requests, including location services and optional account/cloud-sync features, and make the data flow clear to users.
- Review Supabase access policies and authorization rules if cloud accounts are enabled. Client-side publishable keys are not a substitute for correct server-side policies.
- Audit all uses of `innerHTML` that include user input or external API data. Use `textContent` for plain text and safe DOM construction for structured UI.
- Run browser-level tests, calculation reference tests, dependency review, and a privacy review before public deployment.

This document describes source-level findings only. It is not a full penetration test or a determination of what data was actually transmitted in past sessions.
