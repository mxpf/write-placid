import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { handleAccessRequest } from "./access-handler";
import type { Props } from "./workers-oauth-utils";

const STUDIO_ORIGIN = "https://studio.internal";

type StudioSource = { label: string; href: string };

type StudioPost = {
	type: "post";
	title: string;
	slug: string;
	date: string;
	publishedAt?: string;
	status: "draft" | "published";
	body: string;
	source?: StudioSource;
};

type StudioLibrary = {
	documents?: StudioPost[];
};

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function slugify(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

async function readStudioLibrary(env: Env): Promise<StudioLibrary> {
	const response = await env.STUDIO.fetch(new Request(`${STUDIO_ORIGIN}/api/content`, {
		headers: { "x-write-placid-token": env.STUDIO_API_TOKEN },
	}));
	if (!response.ok) {
		throw new Error(`Studio could not be read (${response.status}).`);
	}
	return (await response.json()) as StudioLibrary;
}

async function saveToStudio(env: Env, post: StudioPost): Promise<StudioPost> {
	const response = await env.STUDIO.fetch(
		new Request(`${STUDIO_ORIGIN}/api/content/save`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-write-placid-token": env.STUDIO_API_TOKEN,
			},
			body: JSON.stringify(post),
		}),
	);
	const result = (await response.json().catch(() => ({}))) as {
		error?: string;
		document?: StudioPost;
	};
	if (!response.ok || !result.document) {
		throw new Error(result.error || `Studio could not save the draft (${response.status}).`);
	}
	return result.document;
}

export class WritePlacidMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Write Placid",
		version: "1.0.0",
	});

	async init() {
		if (this.props?.email.toLowerCase() !== this.env.ALLOWED_EMAIL.toLowerCase()) return;

		this.server.tool(
			"save_write_placid_draft",
			"Save a complete new essay, fragment, or revision into the private Write Placid Studio library. This never publishes or deletes anything. For a revision, provide the current title or slug so the existing piece is updated instead of duplicated. Send the complete body, not a patch or excerpt.",
			{
				title: z.string().trim().min(1).max(200).describe("The title the piece should have after saving."),
				body: z.string().max(750_000).describe("The complete article body in Markdown. Italics and inline links are supported."),
				current_title: z
					.string()
					.trim()
					.max(200)
					.optional()
					.describe("For a revision or rename, the title currently shown in Studio."),
				slug: z
					.string()
					.trim()
					.max(100)
					.optional()
					.describe("The existing Studio slug, when known. Omit it for a new piece."),
				date: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.optional()
					.describe("Publication date in YYYY-MM-DD form. Existing dates are preserved when omitted."),
				source_label: z.string().trim().max(200).optional(),
				source_url: z.string().url().max(2_000).optional(),
			},
			async ({ title, body, current_title, slug, date, source_label, source_url }) => {
				try {
					const library = await readStudioLibrary(this.env);
					const posts = (library.documents || []).filter((document) => document.type === "post");
					const requestedSlug = slug ? slugify(slug) : "";
					const lookupTitle = (current_title || title).trim().toLocaleLowerCase();
					const existing = posts.find(
						(post) =>
							(requestedSlug && post.slug === requestedSlug) ||
							post.title.trim().toLocaleLowerCase() === lookupTitle,
					);

					if ((source_label && !source_url) || (!source_label && source_url)) {
						throw new Error("A source needs both a label and a URL.");
					}

					const source = source_label && source_url
						? { label: source_label, href: source_url }
						: existing?.source;
					const saved = await saveToStudio(this.env, {
						type: "post",
						title: title.trim(),
						slug: existing?.slug || "",
						date: date || existing?.date || today(),
						publishedAt: existing?.publishedAt || "",
						status: existing?.status || "draft",
						body,
						...(source ? { source } : {}),
					});

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify({
									message: `Saved “${saved.title}” to Write Placid Studio. It has not been published.`,
									title: saved.title,
									slug: saved.slug,
									status: saved.status,
								}),
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: error instanceof Error ? error.message : "Studio could not save the draft.",
							},
						],
						isError: true,
					};
				}
			},
		);
	}
}

export default new OAuthProvider({
	apiHandler: WritePlacidMCP.serve("/mcp"),
	apiRoute: "/mcp",
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: { fetch: handleAccessRequest as any },
	tokenEndpoint: "/token",
});
