/** Bootstrap optional browser enhancements without coupling essential content. */

import {
    BACKGROUND_MAX_BYTES,
    BACKGROUND_MAX_LINES,
    BACKGROUND_TIMEOUT_MS,
    BACKGROUND_URL,
    HERO_MESSAGES,
    ROTATOR_HOLD_MS,
} from './content.js';
import { createBackgroundStream } from './modules/background-stream.js';
import { createBrandCursor } from './modules/brand-cursor.js';
import { createClock } from './modules/clock.js';
import outputLogo from './modules/console-logo.js';
import { loadBackground } from './modules/load-background.js';
import { loadGeolocationMessages } from './modules/load-geolocation.js';
import { createTypewriter, shuffleMessages } from './modules/typewriter.js';

/**
 * Initialize the console logo, optional clock, message rotators, and background stream.
 *
 * @param {Document} doc Document containing data-role hooks.
 * @param {Window} win Window providing browser capabilities.
 * @param {object} [deps] Optional browser capability overrides.
 * @param {Function} [deps.fetch] Fetch implementation for local and remote assets.
 * @param {Function} [deps.random] Random source for decorative pacing.
 * @param {{info: Function}} [deps.console] Diagnostic sink.
 * @returns {{destroy: Function}} Idempotent teardown handle.
 */
export const initApp = (doc, win, deps = {}) => {
    if (!doc?.querySelector || !win) {
        throw new TypeError('document and window are required');
    }

    const diagnostics = deps.console ?? globalThis.console;
    const random = deps.random ?? Math.random;
    const report = (scope, error) => {
        const message = error?.message ?? String(error);
        diagnostics?.info?.(`[sysetup] ${scope} unavailable: ${message}`);
    };
    const byRole = (role) => doc.querySelector(`[data-role="${role}"]`);
    const reducedMotion =
        typeof win.matchMedia === 'function' &&
        win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const handles = [];
    const backgroundController =
        typeof AbortController === 'function' ? new AbortController() : null;
    const geolocationController =
        typeof AbortController === 'function' ? new AbortController() : null;
    const fetchImpl = deps.fetch ?? win.fetch?.bind(win);
    let backgroundHandle = null;
    let destroyed = false;

    try {
        outputLogo(diagnostics);
    } catch (error) {
        report('console logo', error);
    }

    try {
        const brandCursor = byRole('brand-cursor');
        if (brandCursor) {
            handles.push(
                createBrandCursor(brandCursor, {
                    document: doc,
                    window: win,
                    reducedMotion,
                })
            );
        }
    } catch (error) {
        report('brand cursor', error);
    }

    try {
        const dateElement = byRole('date');
        const timeElement = byRole('time');
        if (dateElement && timeElement) {
            const clock = createClock({
                dateElement,
                timeElement,
                document: doc,
            });
            clock.start();
            handles.push(clock);
        }
    } catch (error) {
        report('clock', error);
    }

    try {
        const rotator = byRole('typewriter');
        if (rotator) {
            const typewriter = createTypewriter(
                rotator,
                shuffleMessages(HERO_MESSAGES, random),
                {
                    advanceOnInteraction: true,
                    document: doc,
                    holdMs: ROTATOR_HOLD_MS,
                    random,
                    reducedMotion,
                    onStateChange: (state) => {
                        if (state === 'holding') {
                            rotator.classList.add('shimmer-active');
                        } else {
                            rotator.classList.remove('shimmer-active');
                        }
                    },
                }
            );
            typewriter.start();
            handles.push(typewriter);
        }
    } catch (error) {
        report('rotator', error);
    }

    try {
        const background = byRole('background');
        if (background && fetchImpl) {
            loadBackground({
                fetchImpl,
                maxBytes: BACKGROUND_MAX_BYTES,
                signal: backgroundController?.signal,
                timeoutMs: BACKGROUND_TIMEOUT_MS,
                url: BACKGROUND_URL,
            })
                .then((text) => {
                    if (destroyed) return;
                    const stream = createBackgroundStream(background, text, {
                        document: doc,
                        maxLinesKept: BACKGROUND_MAX_LINES,
                        random,
                        reducedMotion,
                    });
                    stream.start();
                    backgroundHandle = stream;
                })
                .catch((error) => {
                    if (!destroyed) report('background', error);
                });
        }
    } catch (error) {
        report('background', error);
    }

    try {
        const clientLocation = byRole('client-location');
        if (clientLocation && fetchImpl) {
            loadGeolocationMessages({
                fetchImpl,
                signal: geolocationController?.signal,
            })
                .then((messages) => {
                    if (destroyed || messages.length === 0) return;
                    const typewriter = createTypewriter(
                        clientLocation,
                        shuffleMessages(messages, random),
                        {
                            document: doc,
                            random,
                            reducedMotion,
                        }
                    );
                    typewriter.start();
                    handles.push(typewriter);
                })
                .catch((error) => {
                    if (!destroyed) report('geolocation', error);
                });
        }
    } catch (error) {
        report('geolocation', error);
    }

    return {
        destroy() {
            if (destroyed) return;
            destroyed = true;
            backgroundController?.abort();
            geolocationController?.abort();
            for (const handle of handles.splice(0)) handle.destroy();
            backgroundHandle?.destroy();
            backgroundHandle = null;
        },
    };
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    initApp(document, window);
}
