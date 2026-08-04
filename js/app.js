/** Bootstrap optional browser enhancements without coupling essential content. */

import {
    BACKGROUND_MAX_BYTES,
    BACKGROUND_MAX_LINES,
    BACKGROUND_TIMEOUT_MS,
    BACKGROUND_URL,
    HERO_MESSAGES,
    ROTATOR_CHANGE_INTERVAL_MS,
} from './content.js';
import { createBackgroundStream } from './modules/background-stream.js';
import { createClock } from './modules/clock.js';
import { loadBackground } from './modules/load-background.js';
import { createTypewriter, shuffleMessages } from './modules/typewriter.js';

/**
 * Initialize the optional clock, message rotator, and background stream.
 *
 * @param {Document} doc Document containing data-role hooks.
 * @param {Window} win Window providing browser capabilities.
 * @param {object} [deps] Optional browser capability overrides.
 * @param {Function} [deps.fetch] Fetch implementation for the local asset.
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
    let backgroundHandle = null;
    let destroyed = false;

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
                    changeIntervalMs: ROTATOR_CHANGE_INTERVAL_MS,
                    document: doc,
                    random,
                    reducedMotion,
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
        const fetchImpl = deps.fetch ?? win.fetch?.bind(win);
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

    return {
        destroy() {
            if (destroyed) return;
            destroyed = true;
            backgroundController?.abort();
            for (const handle of handles.splice(0)) handle.destroy();
            backgroundHandle?.destroy();
            backgroundHandle = null;
        },
    };
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    initApp(document, window);
}
