import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { handleAccessRequest } from "./access-handler";
import type { Props } from "./workers-oauth-utils";
import { prepareDraft, type StudioPost } from "./draft";

const STUDIO_ORIGIN = "https://studio.internal";

type StudioLibrary = {
	documents?: StudioPost[];
};

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
			"Save a complete new essay, fragment, or private draft revision into Write Placid Studio. This never publishes, deletes, or changes previously published writing. For a revision, provide the current title or exact slug. Send the complete body, not a patch or excerpt.",
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
			async (input) => {
				try {
					const library = await readStudioLibrary(this.env);
					const saved = await saveToStudio(this.env, prepareDraft(input, library.documents || []));

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

function oauthProvider(request: Request) {
	return new OAuthProvider({
		apiHandler: WritePlacidMCP.serve("/mcp"),
		apiRoute: "/mcp",
		authorizeEndpoint: "/authorize",
		clientRegistrationEndpoint: "/register",
		defaultHandler: { fetch: handleAccessRequest as any },
		resourceMetadata: {
			resource: `${new URL(request.url).origin}/mcp`,
		},
		tokenEndpoint: "/token",
	});
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		return oauthProvider(request).fetch(request, env, ctx);
	},
};
