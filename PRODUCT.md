# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People in Tanzanian campus communities who have lost or found an item and need a safer way to search, report, and arrange a return. Institution and security staff review reports and claims and coordinate handovers.

## Product Purpose

Vilivyopotea na Kupatikana is a lost-and-found platform foundation. It aims to help people discover reviewed listings while keeping identifying clues and claimant details private, and to support staff-mediated returns.

## Positioning

Public-safe summaries, private claims, institution-scoped staff review, and human verification keep discovery separate from ownership decisions. Matching suggestions, when explicitly enabled, are assistive leads only.

## Operating Context

The repository contains a standalone marketing site, a Next.js product application, a Go API, PostgreSQL, an optional private Python matching service, and a read-only MCP adapter. The intended operating context is institutional, with staff responsible for reviewing listings, claims, and handovers.

## Capabilities and Constraints

- The project is pre-pilot. No institution, including DIT, has approved a pilot or endorsed the concept.
- Use fictional records only until written institutional approval and required privacy, security, accessibility, and operational reviews are complete.
- Demo role selection previews interfaces and does not grant permissions.
- Public discovery is limited to reviewed and redacted listing summaries. Claims, contact details, evidence references, withheld clues, and staff notes are private.
- Local PostgreSQL identity, institution membership, platform administration, and data scopes are enforced server-side.
- AI matching is disabled by default, returns suggestions only, and never verifies ownership or decides claims.
- The MCP adapter is read-only and exposes public listing and institution information only.

## Evidence on Hand

The repository contains fictional interface previews and service implementations. It contains no approved institutional pilot, real user evidence, partner endorsement, or production service evidence. Do not invent testimonials, adoption, outcome metrics, or institutional relationships.

## Product Principles

- Keep distinctive ownership clues private.
- Publish only reviewed, public-safe summaries.
- Keep claims and contact details private.
- Leave ownership and return decisions to people.
- Be clear that the current experience is a fictional pre-pilot preview.
