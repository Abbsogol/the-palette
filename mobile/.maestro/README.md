# Native journeys

`unconfigured.yml` proves the default binary refuses to contact unverified services. It does not certify authentication, booking or billing.

`staging-auth.yml` is an initial journey for an already-onboarded synthetic account. Supply `TEST_EMAIL` and `TEST_PASSWORD` through the test runner's secret environment, never committed files. Run it only against the isolated project recorded in the beta verification report. It is not yet executed or certified.

The booking, messaging, process-termination and purchase acceptance scenarios remain in `../../docs/mobile-beta/verification.md` until real staging accounts, valid native builds and stores are available. Do not use the configuration smoke as a replacement for these gates.
