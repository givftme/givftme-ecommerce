# Givtme Product Specification

These documents are the product source of truth for the current Givtme build.

## Precedence

1. `02-experience-design.md` defines what the experience should feel like.
2. `03-user-journey-and-build-specification.md` defines journeys, data model, acceptance criteria, and build sequence.
3. `01-business-case-and-financial-model.md` defines the business rationale, commercial model, and strategic priorities.
4. `04-the-story.md` defines the brand narrative and messaging.

Where the User Journey & Build Specification conflicts with Experience Design, Experience Design takes precedence.

## Existing-codebase rule

Treat the repository as a brownfield application. Reuse working functionality that remains compatible with these specifications. Existing behavior is not automatically a requirement: when it conflicts with the product specification, plan a migration toward the specified behavior rather than preserving it by default.

## Current platform priorities

The existing e-commerce/store foundation should be reused. The platform layer to complete is:

1. Public shareable wishlists and guest journey.
2. Reliable occasion reminders aligned with the specified reminder ladder.
3. External product-link unfurling with graceful manual fallback.
4. Gift pooling with real monetary contributions; payment/escrow implementation remains decision-gated and Givtme must not directly hold pooled funds.
5. Fulfilment/reveal improvements including delivery windows and delivery-photo loop.

Multi-currency, corporate dashboard, mascot animations, Wrapped, ads platform, and native mobile apps are later roadmap items and should not expand the initial twelve-week build unless explicitly authorized.
