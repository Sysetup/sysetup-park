#!/usr/bin/env node
/**
 * build-background.mjs — build-time generator for the SYSETUP code background.
 *
 * Replaces live browser GitHub enumeration with a finite, reviewed local
 * snapshot. Run manually whenever the background should be refreshed:
 *
 *     node scripts/build-background.mjs
 *
 * The script interactively asks which repositories to include, which files of
 * each selected repository to include, and whether to pre-highlight the code
 * with the vendored Highlight.js build (js/highlight.min.js). The result is
 * written to js/generated/background.html and loaded by js/yj1.js at runtime
 * through one bounded, same-origin fetch.
 *
 * Optional environment:
 *     GITHUB_TOKEN  classic PAT for private repos / higher rate limits.
 *                   Read from the environment only, never stored or printed.
 */

import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, env, exit } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_FILE = path.join(ROOT, "js", "generated", "background.html");
const VENDOR_HIGHLIGHT = path.join(ROOT, "js", "highlight.min.js");

const GITHUB_OWNER = "sysetup";
const GITHUB_API_HOST = "api.github.com";
// Extension -> Highlight.js grammar name. Files whose extension is not in
// this map are skipped; highlighting always uses an explicit grammar
// (hljs.highlight), never unbounded highlightAuto detection.
const EXTENSION_TO_LANGUAGE = new Map([
	["js", "javascript"],
	["mjs", "javascript"],
	["md", "markdown"],
	["sh", "bash"],
	["bash", "bash"],
	["ml", "ocaml"],
	["html", "xml"],
	["htm", "xml"],
	["css", "css"],
	["py", "python"],
	["java", "java"],
	["rb", "ruby"],
	["php", "php"],
	["json", "json"],
	["yml", "yaml"],
	["yaml", "yaml"],
]);
const MAX_REPOS = 100;
const MAX_FILES_PER_REPO = 200;
const MAX_FILE_BYTES = 50 * 1024;
const MAX_TOTAL_BYTES = 600 * 1024;
const FETCH_TIMEOUT_MS = 10000;

const escapeHtml = (text) =>
	text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const isCodeFile = (name) => {
	const dot = name.lastIndexOf(".");
	if (dot < 0) return false;
	return EXTENSION_TO_LANGUAGE.has(name.slice(dot + 1).toLowerCase());
};

const languageFor = (name) => {
	const dot = name.lastIndexOf(".");
	if (dot < 0) return "";
	return EXTENSION_TO_LANGUAGE.get(name.slice(dot + 1).toLowerCase()) || "";
};

const fetchJson = async (url, headers) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, { headers, signal: controller.signal });
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
		}
		return await response.json();
	} finally {
		clearTimeout(timer);
	}
};

const fetchTextCapped = async (url, headers, maxBytes) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, { headers, signal: controller.signal });
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
		}
		const declared = Number(response.headers.get("content-length") || 0);
		if (declared > maxBytes) {
			throw new Error(`file exceeds ${maxBytes} bytes (declared ${declared})`);
		}
		const reader = response.body.getReader();
		const chunks = [];
		let received = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			received += value.byteLength;
			if (received > maxBytes) {
				await reader.cancel();
				throw new Error(`file exceeds ${maxBytes} bytes`);
			}
			chunks.push(value);
		}
		return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
	} finally {
		clearTimeout(timer);
	}
};

const githubHeaders = (token) => {
	const headers = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "sysetup-background-builder",
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
};

const listRepos = async (headers) => {
	const repos = await fetchJson(
		`https://${GITHUB_API_HOST}/users/${GITHUB_OWNER}/repos?per_page=${MAX_REPOS}&sort=updated`,
		headers
	);
	if (!Array.isArray(repos)) throw new Error("unexpected repos payload");
	return repos
		.filter((repo) => repo && typeof repo.name === "string" && !repo.fork)
		.slice(0, MAX_REPOS)
		.map((repo) => repo.name);
};

const listRepoFiles = async (repo, headers) => {
	const tree = await fetchJson(
		`https://${GITHUB_API_HOST}/repos/${GITHUB_OWNER}/${repo}/git/trees/HEAD?recursive=1`,
		headers
	);
	if (!tree || !Array.isArray(tree.tree)) return [];
	return tree.tree
		.filter(
			(node) =>
				node &&
				node.type === "blob" &&
				typeof node.path === "string" &&
				typeof node.size === "number" &&
				node.size <= MAX_FILE_BYTES &&
				isCodeFile(node.path)
		)
		.slice(0, MAX_FILES_PER_REPO)
		.map((node) => ({ path: node.path, size: node.size }));
};

const parseSelection = (answer, count) => {
	const trimmed = answer.trim().toLowerCase();
	if (trimmed === "" || trimmed === "a" || trimmed === "all") {
		return Array.from({ length: count }, (_, index) => index);
	}
	if (trimmed === "n" || trimmed === "none") {
		return [];
	}
	const selected = new Set();
	for (const part of trimmed.split(",")) {
		const index = Number(part.trim());
		if (!Number.isInteger(index) || index < 1 || index > count) {
			throw new Error(`invalid selection "${part.trim()}" (allowed: 1-${count}, "all", "none")`);
		}
		selected.add(index - 1);
	}
	return [...selected].sort((a, b) => a - b);
};

const main = async () => {
	if (!stdin.isTTY) {
		console.error("error: this script is interactive; run it in a terminal.");
		exit(1);
	}

	const token = env.GITHUB_TOKEN || "";
	const headers = githubHeaders(token);
	console.log(`Fetching repository list for "${GITHUB_OWNER}"...`);
	const repos = await listRepos(headers);
	if (!repos.length) {
		console.error("error: no repositories found.");
		exit(1);
	}

	const rl = createInterface({ input: stdin, output: stdout });
	try {
		console.log("\nRepositories:");
		repos.forEach((name, index) => console.log(`  ${String(index + 1).padStart(3)}) ${name}`));
		const repoAnswer = await rl.question(
			`\nSelect repositories to include (comma-separated numbers, "all", "none") [all]: `
		);
		const repoIndexes = parseSelection(repoAnswer, repos.length);
		if (!repoIndexes.length) {
			console.log("No repositories selected; nothing to build.");
			exit(0);
		}

		const chosenFiles = [];
		for (const repoIndex of repoIndexes) {
			const repo = repos[repoIndex];
			console.log(`\nFetching file list for ${repo}...`);
			const files = await listRepoFiles(repo, headers);
			if (!files.length) {
				console.log(`  (no code files under ${MAX_FILE_BYTES / 1024} KiB; skipped)`);
				continue;
			}
			files.forEach((file, index) =>
				console.log(`  ${String(index + 1).padStart(3)}) ${file.path} (${file.size} B)`)
			);
			const fileAnswer = await rl.question(
				`Select files from ${repo} (numbers, "all", "none") [all]: `
			);
			for (const fileIndex of parseSelection(fileAnswer, files.length)) {
				chosenFiles.push({ repo, path: files[fileIndex].path });
			}
		}

		if (!chosenFiles.length) {
			console.log("No files selected; nothing to build.");
			exit(0);
		}

		const highlightAnswer = await rl.question(
			"\nHighlight the snapshot with Highlight.js at build time? (y/n) [y]: "
		);
		const useHighlight = highlightAnswer.trim().toLowerCase() !== "n";

		let hljs = null;
		if (useHighlight) {
			hljs = require(VENDOR_HIGHLIGHT);
			if (!hljs || typeof hljs.highlight !== "function") {
				throw new Error("could not load vendored Highlight.js build");
			}
		}

		console.log(`\nDownloading ${chosenFiles.length} file(s)...`);
		const blocks = [];
		let totalBytes = 0;
		for (const file of chosenFiles) {
			const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${file.repo}/HEAD/${file.path}`;
			try {
				const code = await fetchTextCapped(rawUrl, token ? { Authorization: `Bearer ${token}`, "User-Agent": "sysetup-background-builder" } : { "User-Agent": "sysetup-background-builder" }, MAX_FILE_BYTES);
				totalBytes += Buffer.byteLength(code);
				if (totalBytes > MAX_TOTAL_BYTES) {
					console.warn(`  ! total snapshot cap reached (${MAX_TOTAL_BYTES / 1024} KiB); stopping.`);
					break;
				}
				const language = languageFor(file.path);
				let body;
				if (hljs && language && hljs.getLanguage(language)) {
					try {
						body = hljs.highlight(code, { language }).value;
					} catch {
						body = escapeHtml(code);
					}
				} else {
					body = escapeHtml(code);
				}
				blocks.push({ repo: file.repo, path: file.path, lang: language, html: body });
				console.log(`  + ${file.repo}/${file.path}`);
			} catch (error) {
				console.warn(`  ! skipped ${file.repo}/${file.path}: ${error.message}`);
			}
		}

		if (!blocks.length) {
			console.error("error: no file could be downloaded; snapshot not written.");
			exit(1);
		}

		const generatedAt = new Date().toISOString();
		const highlightedAttr = hljs ? "true" : "false";
		const parts = [
			`<pre id="background-snapshot" data-generated="${generatedAt}" data-highlighted="${highlightedAttr}">`,
		];
		for (const block of blocks) {
			parts.push(`<div class="spacer"></div>`);
			parts.push(
				`<div class="code-block" data-source="${escapeHtml(`${block.repo}/${block.path}`)}" data-lang="${escapeHtml(block.lang)}">\n${block.html}\n</div>`
			);
		}
		parts.push(`<div class="spacer"></div>`);
		parts.push(`</pre>`, ``);

		await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
		await writeFile(OUTPUT_FILE, parts.join("\n"), "utf8");
		console.log(
			`\nWrote ${path.relative(ROOT, OUTPUT_FILE)} with ${blocks.length} block(s), highlighted=${highlightedAttr}.`
		);
	} finally {
		rl.close();
	}
};

main().catch((error) => {
	console.error(`error: ${error.message}`);
	exit(1);
});
