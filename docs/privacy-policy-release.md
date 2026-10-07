# Privacy policy release — 28 September 2026

Public route: `https://www.laque.app/privacy`.

The owner supplied the operator name **WeActivate Project Management Services LLC**, location **Dubai, United Arab Emirates**, and privacy contact **contact@laque.app**. Delivery to that mailbox and the business's request-handling process have not been tested.

This branch is based on `21a366a111f02fee727ecbf9e3d739b235cd0efc`, verified as the currently deployed production source. Its application changes are limited to the static policy page, styles, profile/help links, and hiding the app navigation on the policy. It contains no beta feature, database, billing or environment changes.

The policy describes the data used by the website and mobile beta, with feature-availability qualifications. Pinterest is planned and unapproved. Native billing is described conditionally. Retention periods and transfer safeguards must be maintained and verified by the operator; this notice is not a legal-compliance certification.

References: [Pinterest developer guidelines](https://policy.pinterest.com/en/developer-guidelines), [ICO privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/), and [Vercel Analytics privacy](https://vercel.com/docs/analytics/privacy-policy).

Verification before release:

- Policy, help and navigation files: zero ESLint errors or warnings.
- Profile: 8 existing lint errors and 2 warnings; baseline comparison confirms exactly the same findings after the link additions.
- Same policy source passes the beta branch production smoke build.
- Browser: renders without login; all 14 section targets exist; contents navigation works; no horizontal overflow at 393 px.
- Vercel initially rejected the Mac's automatically generated local Git email. The release follow-up uses the repository owner's existing Git identity. No access permissions are changed.

The Pinterest application remains a draft. A privacy URL does not confer API approval or access to restricted partner search.
