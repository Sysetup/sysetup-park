/** Render the Sysetup identity message in the browser console. */

const OUTPUT_LOGO_TRAILING_PADDING = '       ';
const OUTPUT_LOGO = [
    '   ____             __',
    '  / __/_ _____ ___ / /___ _____ _/|',
    String.raw` _\ \/ // (_-</ -_) __/ // / _ > _<`,
    String.raw`/___/\_, /___/\__/\__/\_,_/ .__//`,
    `    /___/                /_/${OUTPUT_LOGO_TRAILING_PADDING}`,
    '> Systems development company.',
].join('\n');

/**
 * Print the Sysetup ASCII logo.
 *
 * @param {{info?: Function}} [diagnostics] Console-compatible output sink.
 * @returns {void}
 */
const outputLogo = (diagnostics = globalThis.console) => {
    if (!diagnostics || typeof diagnostics.info !== 'function') return;
    diagnostics.info(OUTPUT_LOGO);
};

export default outputLogo;
