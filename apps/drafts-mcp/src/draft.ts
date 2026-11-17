type StudioSource = { label: string; href: string };

export type StudioPost = {
	id?: string;
	editBase?: string;
	type: "post" | "page" | "now";
	title: string;
	dek?: string;
	slug: string;
	date: string;
	publishedAt?: string;
	publishedSource?: string;
	publishedRevision?: string;
	remoteSha?: string;
	aliases?: string[];
	status: "draft" | "published";
	body: string;
	source?: StudioSource;
};

type DraftInput = {
	title: string;
	dek?: string;
	body: string;
	current_title?: string;
	slug?: string;
	date?: string;
	source_label?: string;
	source_url?: string;
};

/** Carry Studio's identity and edit base back unchanged so its save checks apply. */
export function prepareDraft(input: DraftInput, documents: StudioPost[]): StudioPost {
	const posts = documents.filter((document) => document.type === "post");
	const lookupTitle = (input.current_title || input.title).trim().toLocaleLowerCase();
	const matches = input.slug
		? posts.filter((post) => post.slug === input.slug)
		: posts.filter((post) => post.title.trim().toLocaleLowerCase() === lookupTitle);
	if (matches.length > 1) throw new Error("More than one piece matches. Use the private draft's exact slug.");
	const existing = matches[0];
	if (!existing && (input.slug || input.current_title)) {
		throw new Error("That draft could not be found. Check its current title or slug in Studio before trying again.");
	}
	if (existing && input.slug && input.current_title && existing.title.trim().toLocaleLowerCase() !== lookupTitle) {
		throw new Error("The current title and slug identify different pieces. Check the draft in Studio before trying again.");
	}
	if (existing && (existing.status !== "draft" || existing.publishedAt || existing.publishedSource
		|| existing.publishedRevision || existing.remoteSha || existing.aliases?.length)) {
		throw new Error("This tool only updates private drafts with no publication history. Open Studio to review this piece.");
	}
	if (existing && (!existing.id || !existing.editBase)) {
		throw new Error("Studio did not return this draft's identity and saved version. Reopen Studio before trying again.");
	}
	if ((input.source_label && !input.source_url) || (!input.source_label && input.source_url)) {
		throw new Error("A source needs both a label and a URL.");
	}
	const source = input.source_label && input.source_url
		? { label: input.source_label, href: input.source_url }
		: existing?.source;
	return {
		...(existing ? { id: existing.id, editBase: existing.editBase } : {}),
		type: "post",
		title: input.title.trim(),
		dek: input.dek === undefined ? existing?.dek || "" : input.dek,
		slug: existing?.slug || "",
		date: input.date || existing?.date || new Date().toISOString().slice(0, 10),
		publishedAt: "",
		status: "draft",
		body: input.body,
		...(source ? { source } : {}),
	};
}
