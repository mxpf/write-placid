import { type WritingDocument } from "./content.ts";
type MigrationOptions = {
    draftIds?: Record<string, string>;
    publicStatusAuthority?: string[];
};
/** Bootstrap only: deployed published content wins; all private drafts are retained. */
export declare function planEditorialMigration(kdrive: WritingDocument[], cached: WritingDocument[], published: WritingDocument[], options?: MigrationOptions): {
    version: number;
    documents: WritingDocument[];
    mapping: {
        previousKdriveStatus?: string;
        previousCacheStatus?: string;
        status: string;
        id: string;
        legacyIds: string[];
        kdrivePath?: string;
        cachedId?: string;
        publicPath: string;
        source: string;
    }[];
    draftIds: {
        [x: string]: string;
    };
    warnings: string[];
    differences: {
        id: string;
        source: string;
        title: string;
    }[];
    backup: {
        kdrive: WritingDocument[];
        cached: WritingDocument[];
        published: WritingDocument[];
    };
};
export {};
//# sourceMappingURL=editorial-migration.d.ts.map