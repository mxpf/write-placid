import { snapshotPath } from "./content.js";
import { assertValidRepository } from "./editorial.js";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ids = (document) => [document.id, ...(document.legacyIds || [])];
function sameIdentity(a, b) {
    return a.type === b.type && (ids(a).some((id) => ids(b).includes(id)) || a.slug === b.slug || a.path === b.path);
}
function oneMatch(document, candidates, source) {
    const matches = candidates.filter((candidate) => sameIdentity(document, candidate));
    if (matches.length > 1)
        throw new Error(`Ambiguous ${source} match for ${document.slug}`);
    return matches[0];
}
/** Bootstrap only: deployed published content wins; all private drafts are retained. */
export function planEditorialMigration(kdrive, cached, published, options = {}) {
    const documents = [];
    const warnings = [];
    const differences = [];
    const mapping = [];
    const consumedKdrive = new Set();
    const consumedCache = new Set();
    const draftIds = { ...options.draftIds };
    assertValidRepository(published);
    function add(authority, canonical, previous, publicDocument) {
        if (canonical && consumedKdrive.has(canonical))
            throw new Error(`Multiple documents claim ${canonical.kdrivePath}`);
        if (previous && consumedCache.has(previous))
            throw new Error(`Multiple documents claim cached ID ${previous.id}`);
        if (canonical)
            consumedKdrive.add(canonical);
        if (previous)
            consumedCache.add(previous);
        const key = canonical?.kdrivePath || previous?.id || authority.id;
        const id = publicDocument ? authority.id : uuid.test(authority.id) && authority.identityPersisted ? authority.id : draftIds[key] ||= crypto.randomUUID();
        const legacyIds = [...new Set([...(authority.legacyIds || []), ...[canonical, previous].filter(Boolean).flatMap((item) => ids(item)), ...(!publicDocument ? [authority.id] : [])])].filter((oldId) => oldId !== id);
        const publicPath = publicDocument ? authority.publicPath : `${authority.slug}.md`;
        for (const [name, old] of [["KDrive", canonical], ["D1", previous]]) {
            if (old && old.body.trim() !== authority.body.trim()) {
                differences.push({ id, source: name, title: authority.title });
                if (!publicDocument)
                    warnings.push(`Private draft content differs in ${name}: ${authority.title}`);
            }
        }
        const document = {
            ...authority, id, legacyIds, publicPath, path: snapshotPath(authority.type, publicPath),
            status: publicDocument ? authority.status : "draft",
            identityPersisted: true, aliases: [...(authority.aliases || [])],
            kdrivePath: canonical?.kdrivePath, kdriveEtag: canonical?.kdriveEtag,
            googleDocId: previous?.googleDocId || canonical?.googleDocId || "",
            driveRevision: previous?.driveRevision || canonical?.driveRevision || "",
            driveSyncedBody: previous?.driveSyncedBody || canonical?.driveSyncedBody || "",
        };
        documents.push(document);
        mapping.push({ previousKdriveStatus: canonical?.status, previousCacheStatus: previous?.status, status: document.status, id, legacyIds, kdrivePath: canonical?.kdrivePath, cachedId: previous?.id, publicPath, source: publicDocument ? "deployed-public" : canonical ? "kdrive-draft" : "d1-draft" });
    }
    for (const live of published) {
        if (!live.identityPersisted || !uuid.test(live.id))
            throw new Error(`Public document lacks its deployed UUID: ${live.slug}`);
        const canonical = oneMatch(live, kdrive, "KDrive");
        const previous = oneMatch(live, cached, "D1");
        if (canonical && canonical.status !== live.status && !options.publicStatusAuthority?.includes(live.id))
            throw new Error(`Published status disagrees with KDrive folder for ${live.slug}`);
        add(live, canonical, previous, true);
    }
    for (const canonical of kdrive) {
        if (consumedKdrive.has(canonical))
            continue;
        if (canonical.status === "published")
            throw new Error(`Unmatched published KDrive document: ${canonical.kdrivePath}`);
        add(canonical, canonical, oneMatch(canonical, cached, "D1"), false);
    }
    for (const previous of cached) {
        if (consumedCache.has(previous))
            continue;
        if (previous.status === "published")
            throw new Error(`Unmatched published D1 document: ${previous.slug}`);
        add(previous, undefined, previous, false);
    }
    const byOldId = new Map();
    for (const document of documents)
        for (const oldId of ids(document)) {
            if (byOldId.has(oldId) && byOldId.get(oldId) !== document.id)
                throw new Error(`Legacy ID collision: ${oldId}`);
            byOldId.set(oldId, document.id);
        }
    const translate = (value) => value.replace(/doc:([^\s)#]+)(#[^\s)]*)?/g, (_, encoded, fragment = "") => {
        const id = decodeURIComponent(encoded);
        return `doc:${encodeURIComponent(byOldId.get(id) || id)}${fragment}`;
    });
    for (const document of documents) {
        document.body = translate(document.body);
        if (document.source)
            document.source = { ...document.source, href: translate(document.source.href) };
    }
    assertValidRepository(documents);
    return { version: 1, documents, mapping, draftIds, warnings, differences, backup: { kdrive, cached, published } };
}
//# sourceMappingURL=editorial-migration.js.map