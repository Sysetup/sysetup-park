/** Static presentation content and bounded local-asset settings. */

/** Decorative messages rendered by the optional typewriter. */
export const HERO_MESSAGES = Object.freeze([
    'Analyzing requirements to architect robust software solutions.',
    'Designing maintainable systems around real operational needs.',
    'Developing custom software for clear business outcomes.',
    'Building resilient platforms from idea to everyday operation.',
    'Connecting thoughtful design with dependable implementation.',
    'Maintaining useful systems through careful iteration.',
    'Turning complex needs into practical digital products.',
    'Supporting full-cycle projects with a human focus.',
]);

/** Fixed interval between the start of two rotator messages (milliseconds). */
export const ROTATOR_CHANGE_INTERVAL_MS = 18_000;

/** Same-origin route for the decorative plain-text asset. */
export const BACKGROUND_URL = 'assets/background.txt';

/** Maximum accepted background asset size in bytes. */
export const BACKGROUND_MAX_BYTES = 64 * 1024;

/** Maximum time allowed for the optional background request. */
export const BACKGROUND_TIMEOUT_MS = 5000;

/** Maximum number of visible background lines retained in memory. */
export const BACKGROUND_MAX_LINES = 90;
