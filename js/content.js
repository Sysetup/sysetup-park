/** Static presentation content and bounded local-asset settings. */

/** Decorative messages rendered by the optional typewriter. */
export const HERO_MESSAGES = Object.freeze([
    'Analyzing requirements to architect robust software and system solutions.',
    'Designing scalable systems with lifecycle-focused logistics integration.',
    'Developing custom software aligned to operational and business needs.',
    'Implementing secure, maintainable platforms with continuous improvement.',
    'Maintaining system integrity through proactive monitoring and updates.',
    'Orchestrating end-to-end system delivery from spec through production.',
    'Driving efficiency via data-driven analysis and process optimization.',
    'Engineering resilient architectures with modular, maintainable components.',
    'Integrating software and logistics workflows for seamless operations.',
    'Translating complex needs into detailed design and implementation plans.',
    'Delivering turnkey solutions covering dev, deploy, and long-term support.',
    'Managing full-cycle projects: analysis, design, dev, deploy, maintenance.',
    'Aligning systems development to SLA-driven maintenance and reliability.',
    'Optimizing system logistics with automated deployment and versioning.',
    'Delivering professional-grade solutions with 24/7 operational readiness.',
    'Ensuring continuity via structured testing, rollout, and support cycles.',
    'Bridging analysis to operations with clear design and maintenance docs.',
    'Coordinating cross-functional teams for system planning and upkeep.',
    'Streamlining deployments with config management and runbook automation.',
    'Sustaining performance through lifecycle governance and audits',
]);

/** Time to keep each hero message visible after it finishes typing (milliseconds). */
export const ROTATOR_HOLD_MS = 47_000;

/** Same-origin route for the decorative plain-text asset. */
export const BACKGROUND_URL = 'assets/background.txt';

/** Maximum accepted background asset size in bytes. */
export const BACKGROUND_MAX_BYTES = 64 * 1024;

/** Maximum time allowed for the optional background request. */
export const BACKGROUND_TIMEOUT_MS = 5000;

/** Maximum number of visible background lines retained in memory. */
export const BACKGROUND_MAX_LINES = 90;
