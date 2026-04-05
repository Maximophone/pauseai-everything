# Research Brief: CRM Selection for PauseAI Global

## About us

PauseAI Global is a small international advocacy nonprofit focused on AI safety policy. We have 3 paid staff (CEO, Comms Director, Org Director), ~5 active contractors/operations volunteers, and a wider network of volunteers across 15+ countries. We coordinate national chapters, run campaigns, organize protests, and lobby politicians.

We currently have no CRM. Our member/volunteer data lives in Airtable with Mailersend automations handling onboarding emails, but the system is inadequate — it stores contacts but doesn't track interactions, relationship stages, or churn. We want to replace it with a proper CRM.

## What we need

We have two distinct CRM needs that could live in one system or two:

### Need 1: Volunteer/Member Lifecycle Management (PRIMARY — this is the most important)

This is our core operational system. Everyone who joins PauseAI goes through a lifecycle and we need to manage it.

**Contact volume:**
- Current: ~3,000 members in our database
- Current intake: ~200 new joiners/month
- Target intake in 12 months: 1,000–2,000/month
- So the system must comfortably handle 10,000–30,000 contacts within a year

**The lifecycle we need to manage:**

1. **Intake:** Someone fills out a join form. They enter the system. Based on their country, they are routed to their national chapter (if one exists) or to PauseAI Global.
2. **Automated onboarding sequence:** They receive a welcome email. Based on their profile (motivation level, skills, country), they may receive different follow-up sequences.
3. **Human follow-up:** For high-potential joiners, a team member reaches out personally (email, sometimes Discord or video call). This interaction must be loggable in the system.
4. **Ongoing engagement:** At regular intervals, all active members receive communications — mass mobilization emails (go to this protest, sign this petition), newsletters, localized calls to action (segmented by country/chapter).
5. **Heartbeat / churn detection:** Regular check-in emails to confirm people are still active. If someone doesn't engage for X weeks, they're flagged or moved to a "dormant" status. Ideally some of this is automated.
6. **Lifecycle stages:** We need to track where each person is — e.g., Joined → Onboarding → Active → Highly Active → Dormant → Churned (exact stages TBD, but the system must support customizable stages/pipelines).

**Communication requirements:**
- Broadcast email to segments of our member base. Must support segmentation by country, chapter, tags, engagement level, lifecycle stage, and ideally dynamic segments (e.g., "all German volunteers who joined in the last 3 months and haven't attended an event").
- Personalized mass email — mail-merge style where each email appears personal but is sent at scale. Replies should go to a shared inbox (not individual inboxes).
- Email analytics: open rates, click rates, reply rates.
- Email sequences/drip campaigns: automated multi-step email sequences triggered by actions or time delays.

**Tagging and segmentation:**
- Flexible tagging system — we need to define our own tags and change them over time.
- Dynamic segments/smart lists based on combinations of tags, fields, activity, and dates.
- Key fields per contact: country, chapter, skills/interests (from form), hours committed, lifecycle stage, date joined, last interaction date, events attended, actions taken.

**Access control:**
- 5–10 users from PauseAI Global staff/core team need full read/write access.
- National chapter leads (~15–20 people) may need restricted read-only views of volunteers in their country. This is a nice-to-have, not a dealbreaker. An alternative is that we export/share data with them periodically.

### Need 2: External Stakeholder Relationship Management (SECONDARY)

We also need to manage relationships with:
- **Politicians and government officials** (~hundreds, growing) — track: country, level of government, party, position on AI policy, interaction history, relationship stage (cold → contacted → met → supportive → publicly endorsed)
- **Journalists** (~hundreds) — track: outlet, beat, past coverage of us, pitch history, relationship stage
- **Coalition partners** (other orgs, unions, student groups) — track: org name, key contacts, partnership status, joint actions
- **Donors** (~tens) — track: donation history, communication history

This is a different data model from volunteers. A separate workspace or pipeline within the same tool is fine. A completely separate tool is also acceptable if it's the best approach.

For this need, the requirements are simpler:
- Contact management with custom fields
- Interaction logging (meetings, emails, calls — mostly manual entry is fine)
- Pipeline/stage tracking
- Basic reporting (how many politicians have we met, how many journalists covered us, etc.)
- Multi-user access (same 5–10 people)

### Cross-cutting need: Multi-audience broadcast communications

Beyond the volunteer onboarding sequences, we have a broader need for regular broadcast communications to distinct audiences. These are different from lifecycle/onboarding emails — they are editorial or campaign-driven communications sent to specific groups.

| Audience | Type of communication | Frequency | Approximate current size |
|---|---|---|---|
| All members/supporters | Newsletter | Monthly | Thousands |
| Active volunteers | Mobilization calls (protests, petitions, actions) | Ad hoc, campaign-driven | Hundreds to thousands |
| Volunteers by country/chapter | Localized calls to action | Ad hoc | Tens to hundreds per segment |
| Journalists | Press releases, media advisories | Ad hoc, around campaigns/events | Hundreds |
| Politicians | Campaign emails, open letters | Ad hoc | Hundreds |
| Donors | Donor reports, fundraising appeals | Quarterly | Tens |
| Coalition partners | Joint action coordination emails | Ad hoc | Tens |

**Critical requirement: unified contact records with multiple roles.** A single person can be a member, a donor, and a newsletter subscriber simultaneously. A journalist might also be a supporter. The system must handle one contact record with multiple tags/roles, and that person should receive communications relevant to all their roles — but never receive duplicate copies of the same message if they fall into overlapping segments. This rules out systems that rely on separate, siloed lists for different audiences.

The system should make it easy for our Comms Director to compose a broadcast, select the target audience (by role, tags, country, segment, or combination), and send — with confidence that deduplication is handled automatically.

## Technical environment and integrations

- **Notion:** our internal knowledge management and project management system. The CRM should ideally integrate or at least not conflict with it. Native Notion integration is a plus but not required — we can use n8n to bridge.
- **Airtable:** currently holds our member data + onboarding automations + website data feeds. We plan to migrate the member/relationship data to the CRM. The website data feeds (national chapters list, communities page, about page, statement signatories) will either stay in a slimmed-down Airtable or move to Notion — the CRM does not need to serve website data.
- **n8n (self-hosted):** our automation platform. We can use this to connect systems. Good API and webhook support in the CRM is important.
- **Tally:** our form builder. Join forms are on Tally. The CRM must be able to receive form submissions from Tally (via webhook, Zapier, n8n, or native integration).
- **Mailersend:** our current email sending service. We are open to switching to whatever email infrastructure the CRM provides, or keeping Mailersend if the CRM integrates with it.
- **Website:** built with SvelteKit, currently pulls data from Airtable API. CRM does not need to serve the website.

**Technical capacity:** We have one person who can do light technical work (API integrations, n8n automations) one more experienced developer, and a few volunteers, but their time is limited. The less custom development required, the better. Self-hosted open source is acceptable only if setup and maintenance burden is genuinely low.

## Constraints

- **Budget:** up to €200/month. Nonprofit discounts are very relevant — please check for them.
- **Timeline:** We need to select the tool by end of March 2026 and be operational on it by May 2026. So onboarding/setup time matters — a tool that takes 3 months of configuration is worse than one we can start using in 2 weeks.
- **Scale:** Must handle 10,000–30,000 contacts within a year without pricing becoming prohibitive.
- **GDPR compliance:** Required. We operate in Europe and handle EU citizen data.
- **Data export:** Must be able to export all data at any time. No vendor lock-in.
- **Ease of use:** Our Comms Director and Org Director are not technical. Daily use must be intuitive.

## AI capabilities

This is important to us. We want to leverage AI wherever possible. Valuable AI features would include:
- Good API or MCP server so that the system can be interacted with or driven by an AI
- AI-assisted data entry (e.g., parse an email thread and log the key interaction details)
- Natural language querying ("show me all French volunteers who joined this year and attended at least one event")
- AI-powered segmentation or insights

A tool that is AI-native or has a strong AI roadmap is preferred over one that doesn't.

## Systems to evaluate

Please evaluate at minimum:

- **Lightweight / modern CRMs:** Folk, Attio, Twenty (open source), Clay
- **Traditional CRMs with free/nonprofit tiers:** HubSpot (free tier + nonprofit program), Salesforce Nonprofit Cloud (free licenses program), Zoho CRM, Freshsales, Insightly
- **Nonprofit-specific CRMs:** CiviCRM (open source), Bloomerang, Little Green Light, Action Network, EveryAction / Bonterra
- **Advocacy/organizing platforms:** NationBuilder, Action Network, Engaging Networks
- **Email-first tools with CRM features:** Brevo (formerly Sendinblue), Mailchimp, ActiveCampaign
- **Other:** Airtable itself with better configuration (evaluate whether our problems are the tool or our setup), Notion as CRM (evaluate honestly), and any other system you discover that fits our profile. Research if any are missing from this list.

## What I want in the output

For each system evaluated:
1. Pricing at our scale (5–10 users, 3,000 contacts now, 10,000–30,000 within a year), including nonprofit discounts if available
2. Which of our two needs it covers (volunteer lifecycle, external stakeholders, or both)
3. How well it handles our key requirements: intake/forms integration, email broadcasting with segmentation, email sequences, interaction logging, lifecycle stage tracking, tagging, dynamic segments, unified contact records with multiple roles, deduplication across audiences, access control, API/webhooks
4. AI capabilities (current and roadmap)
5. Integration story (API quality, n8n/Zapier support, Tally/Notion connectors)
6. Time to operational (how long from purchase to actually using it for our workflow)
7. Key strengths and weaknesses for our specific use case
8. Honest assessment of scale — will it still work and be affordable at 30,000 contacts?

Then provide:
9. A shortlist of your top 3–5 recommendations with reasoning
10. Your recommended approach: single tool, or a specific combination of two tools (e.g., "X for volunteer lifecycle + Y for external stakeholders"), with justification
11. For your top recommendation(s), outline what the first 2 weeks of setup would look like — what do we configure first, what data do we migrate first, what can we defer
