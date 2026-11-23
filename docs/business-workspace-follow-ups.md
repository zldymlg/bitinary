# Business workspace follow-ups

The owner workspace exposes actions that have a complete save and read path. The following features need more work before they can return to the owner experience.

| Area | Work needed |
| --- | --- |
| QR check-ins | Generate a scannable code and validate it on the server. The traveler review form currently treats a code of four or more characters as sufficient. Treat existing visit fields as self-reported. |
| Deals, boosts, reservations, and billing | Connect traveler discovery and redemption, paid promotion delivery, reservation requests and decisions, and payment and invoice handling before exposing the respective actions. |
| Branches and staff | Add branch-scoped data and an invitation and acceptance flow with permissions enforced by the database. |
| Review cases and scheduled posts | Connect reports to a durable moderation process and scheduled posts to a publisher before promising delivery. |
| Business search, business Jimbot, and notifications | Connect search and recommendations to live sources before exposing them. Notification inbox read status is persisted. Delivery preferences need a delivery service. |
| Account and verification | Data export, account deletion, linked identity management, device management, and on-site verification each need a complete workflow. |
| Analytics | Instrument saves, trip additions, conversion, and attribution at their source. Historical events that were never recorded cannot be reconstructed. |

## Traveler Jimbot itinerary audit

The normalizer caps ordinary itineraries at two meals per day and schedules them from 11:30 and 18:00. It has no arrival or departure timing constraint. Venue opening hours are available to the detail tool, but the normalizer does not receive them. The trip card keeps the normalized stop order and times, but it estimates transfer duration separately. For example, a 3 km transfer can consume about 19 minutes in the schedule and appear as 45 minutes in the card.

For the follow-up, check ordinary full days for breakfast, lunch, and dinner. Keep only the meals that fit on arrival and departure days. Use a meal break when there is no suitable confirmed venue, honor known opening hours, and use the same transfer estimates in scheduling and display. Add a rendered trip-card check alongside the normalizer and trip projection tests.
