# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Use GitHub Security Advisories for this repository to report the issue privately. Include:

- a description of the vulnerability;
- affected routes, components, or configuration;
- reproduction steps;
- potential impact;
- any suggested mitigation.

You will receive an acknowledgement as soon as possible. Please give the maintainer reasonable time to investigate and release a fix before public disclosure.

## Secrets

This repository must never contain:

- database URLs or passwords;
- authentication secrets or cookie secrets;
- API tokens;
- private deployment URLs or identifiers;
- personal data.

Use `.env.example` for variable names and keep real values in `.env.local`, which is ignored by Git.
