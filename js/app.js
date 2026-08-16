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
                            if (reducedMotion) return;
                            if (
                                typeof rotator.getBoundingClientRect !== 'function' ||
                                typeof doc.createElement !== 'function'
                            ) {
                                return;
                            }

                            const originalText = rotator.textContent;
                            rotator.textContent = '';

                            const words = originalText.trim().split(/\s+/);
                            const wordSpans = words.map((word) => {
                                const span = doc.createElement('span');
                                span.textContent = word;
                                span.style.display = 'inline-block';
                                rotator.appendChild(span);
                                rotator.appendChild(doc.createTextNode(' '));
                                return span;
                            });

                            const lines = [];
                            let currentLine = [];
                            let currentTop = -1;

                            wordSpans.forEach((span) => {
                                const rect = span.getBoundingClientRect();
                                const top = Math.round(rect.top);

                                if (currentTop === -1) {
                                    currentTop = top;
                                    currentLine.push(span);
                                } else if (Math.abs(top - currentTop) < 8) {
                                    currentLine.push(span);
                                } else {
                                    lines.push(currentLine);
                                    currentLine = [span];
                                    currentTop = top;
                                }
                            });
                            if (currentLine.length > 0) {
                                lines.push(currentLine);
                            }

                            rotator.textContent = '';
                            const lineElements = lines.map((lineSpans, idx) => {
                                const lineSpan = doc.createElement('span');
                                lineSpan.className = 'shimmer-line';
                                lineSpan.style.display = 'inline-block';
                                lineSpan.textContent = lineSpans
                                    .map((s) => s.textContent)
                                    .join(' ');
                                rotator.appendChild(lineSpan);
                                if (idx < lines.length - 1) {
                                    rotator.appendChild(doc.createElement('br'));
                                }
                                return lineSpan;
                            });

                            let currentIndex = 0;
                            let activeState = true;

                            rotator._cancelShimmerSequence = () => {
                                activeState = false;
                            };

                            const playNext = () => {
                                if (!activeState) return;

                                lineElements.forEach((line) =>
                                    line.classList.remove('shimmer-active-row')
                                );

                                if (lineElements.length === 0) return;

                                const line = lineElements[currentIndex];
                                if (!line) return;

                                line.classList.add('shimmer-active-row');

                                line.addEventListener(
                                    'animationend',
                                    () => {
                                        if (!activeState) return;
                                        currentIndex =
                                            (currentIndex + 1) %
                                            lineElements.length;
                                        playNext();
                                    },
                                    { once: true }
                                );
                            };

                            playNext();
                        } else {
                            if (typeof rotator._cancelShimmerSequence === 'function') {
                                rotator._cancelShimmerSequence();
                                rotator._cancelShimmerSequence = null;
                            }
                            if (typeof rotator.querySelectorAll === 'function') {
                                const lines = rotator.querySelectorAll('.shimmer-line');
                                lines.forEach((line) =>
                                    line.classList.remove('shimmer-active-row')
                                );
                            }
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
