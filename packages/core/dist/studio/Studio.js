"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, } from "react";
import { GripVertical, Heading2, Image as ImageIcon, Italic, Link as LinkIcon, Quote as QuoteIcon, } from "lucide-react";
import { acknowledgeSave, withEditBase } from "./save-state.js";
import { createSaveQueue } from "./save-queue.js";
import { CaptionEditor } from "./CaptionEditor.js";
import { createEditorRecovery } from "./editor-recovery.js";
import { displayDate } from "./content.js";
import { editorToMarkdown, markdownPasteToEditorHtml, markdownToEditorHtml, numberedListShortcutStart, readEditorImage, updateEditorImage, } from "./rich-text.js";
import { smartenQuotes, smartQuoteForInput } from "./smart-quotes.js";
import { moveItemToTarget } from "./reorder.js";
import { articleImageMarkdown } from "./article-images.js";
import { studioConfig } from "./studio-config.js";
const { rememberEdits, forgetEdits, recoverEdits, lastRecoveredDocument } = createEditorRecovery(studioConfig.recoveryNamespace);
function today() {
    return new Date().toISOString().slice(0, 10);
}
function newPost(type = "post") {
    const temporaryId = `new:${Date.now()}`;
    const date = today();
    const nowSlug = `now-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}`;
    return {
        id: temporaryId,
        path: "",
        type,
        slug: type === "now" ? nowSlug : "",
        title: type === "now" ? "Now" : "",
        date,
        status: "draft",
        publishedAt: "",
        publicUpdatedAt: "",
        body: "",
        remoteSha: "",
        publishedSource: "",
        updatedAt: new Date().toISOString(),
        googleDocId: "",
        driveRevision: "",
        driveSyncedBody: "",
        isDirty: true,
    };
}
function snapshot(document) {
    if (!document)
        return "";
    return JSON.stringify({
        id: document.id,
        type: document.type,
        title: document.title,
        slug: document.slug,
        date: document.date,
        status: document.status,
        publishedAt: document.publishedAt,
        publicUpdatedAt: document.publicUpdatedAt,
        body: document.body,
        source: document.source,
    });
}
function requestedDocument(documents) {
    const parameters = new URLSearchParams(window.location.search);
    const requestedSlug = parameters.get("slug")?.trim();
    const requestedTitle = parameters.get("title")?.trim();
    return ((requestedSlug
        ? documents.find((document) => document.slug === requestedSlug)
        : undefined) ||
        (requestedTitle
            ? documents.find((document) => document.title === requestedTitle)
            : undefined));
}
function clearDocumentRequest() {
    const url = new URL(window.location.href);
    url.searchParams.delete("slug");
    url.searchParams.delete("title");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
function isSafeHref(href) {
    if (href.startsWith("/") || href.startsWith("#"))
        return true;
    try {
        return ["http:", "https:", "mailto:", "doc:"].includes(new URL(href).protocol);
    }
    catch {
        return false;
    }
}
function LibrarySection({ title, documents, selectedId, onSelect, onReorder, }) {
    const [draggedId, setDraggedId] = useState("");
    const [dropTargetId, setDropTargetId] = useState("");
    const [desktopDragEnabled, setDesktopDragEnabled] = useState(false);
    useEffect(() => {
        const query = window.matchMedia("(min-width: 701px) and (pointer: fine)");
        const update = () => setDesktopDragEnabled(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    if (!documents.length)
        return null;
    const reorderable = Boolean(onReorder && desktopDragEnabled);
    return (_jsxs("section", { className: "library-section", children: [_jsx("h2", { children: title }), _jsx("ol", { children: documents.map((document) => (_jsx("li", { className: `${reorderable ? "is-reorderable" : ""} ${draggedId === document.id ? "is-dragging" : ""} ${dropTargetId === document.id ? "is-drop-target" : ""}`.trim(), draggable: reorderable, onDragStart: (event) => {
                        if (!reorderable)
                            return;
                        setDraggedId(document.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", document.id);
                    }, onDragOver: (event) => {
                        if (!reorderable || !draggedId || draggedId === document.id)
                            return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropTargetId(document.id);
                    }, onDragLeave: () => {
                        if (dropTargetId === document.id)
                            setDropTargetId("");
                    }, onDrop: (event) => {
                        event.preventDefault();
                        if (onReorder && draggedId && draggedId !== document.id) {
                            onReorder(draggedId, document.id);
                        }
                        setDraggedId("");
                        setDropTargetId("");
                    }, onDragEnd: () => {
                        setDraggedId("");
                        setDropTargetId("");
                    }, children: _jsxs("button", { className: document.id === selectedId ? "is-active" : "", type: "button", onClick: () => onSelect(document), children: [reorderable ? (_jsx(GripVertical, { className: "drag-handle", "aria-hidden": "true", size: 14 })) : null, _jsx("span", { children: document.title || "Untitled" }), _jsxs("small", { children: [document.type === "page" ? "Page" : displayDate(document.date), document.type === "post" && document.publicUpdatedAt
                                        ? ` · Last edited ${displayDate(document.publicUpdatedAt.slice(0, 10))}`
                                        : "", document.kdrivePath ? ` · ${document.kdrivePath.split("/").slice(0, -1).join("/")}` : "", document.status === "published" && document.isDirty
                                        ? " · Unpublished changes"
                                        : ""] })] }) }, document.id))) })] }));
}
export function Studio() {
    const [documents, setDocuments] = useState([]);
    const [current, setCurrent] = useState(null);
    const [saveState, setSaveState] = useState("Loading…");
    const [notice, setNotice] = useState("");
    const [publishing, setPublishing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [driveConnected, setDriveConnected] = useState(false);
    const [mobileScreen, setMobileScreen] = useState("library");
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkMode, setLinkMode] = useState("add");
    const [linkLabel, setLinkLabel] = useState("");
    const [linkHref, setLinkHref] = useState("");
    const [imageOpen, setImageOpen] = useState(false);
    const [imageMode, setImageMode] = useState("add");
    const [imageFile, setImageFile] = useState(null);
    const [imageAlt, setImageAlt] = useState("");
    const [imageCaption, setImageCaption] = useState("");
    const [imageUploading, setImageUploading] = useState(false);
    const bodyRef = useRef(null);
    const linkTextRef = useRef(null);
    const linkDialogRef = useRef(null);
    const imageDialogRef = useRef(null);
    const imageAltRef = useRef(null);
    const currentRef = useRef(null);
    const lastSavedRef = useRef("");
    const saveQueueRef = useRef(null);
    const publishingRef = useRef(false);
    const livePollRef = useRef(0);
    const driveDiscoveryRanRef = useRef(false);
    const linkSelectionRef = useRef(null);
    const editingLinkRef = useRef(null);
    const imageSelectionRef = useRef(null);
    const imageReturnFocusRef = useRef(null);
    const editingImageRef = useRef(null);
    useEffect(() => {
        currentRef.current = current;
    }, [current]);
    useEffect(() => {
        const warnBeforeLeaving = (event) => {
            if (currentRef.current && snapshot(currentRef.current) !== lastSavedRef.current) {
                event.preventDefault();
                event.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", warnBeforeLeaving);
        return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
    }, []);
    useLayoutEffect(() => {
        const editor = bodyRef.current;
        if (!editor || !current)
            return;
        if (editorToMarkdown(editor) === current.body.trim())
            return;
        editor.innerHTML = markdownToEditorHtml(current.body);
    }, [current]);
    useEffect(() => {
        if (!linkOpen)
            return;
        linkTextRef.current?.focus({ preventScroll: true });
    }, [linkOpen]);
    useEffect(() => {
        if (!imageOpen)
            return;
        const initialFocus = imageMode === "edit" ? imageAltRef.current : imageDialogRef.current?.querySelector('input[type="file"]');
        initialFocus?.focus({ preventScroll: true });
    }, [imageOpen, imageMode]);
    const toggleTheme = () => {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = nextTheme;
        window.localStorage.setItem(studioConfig.themeStorageKey, nextTheme);
    };
    const showNotice = useCallback((message) => {
        setNotice(message);
        window.setTimeout(() => setNotice(""), 4200);
    }, []);
    const selectDocument = useCallback((document) => {
        let recovered = null;
        try {
            recovered = recoverEdits(window.sessionStorage, document);
        }
        catch { /* Unload warning still protects edits if storage is unavailable. */ }
        setCurrent(recovered || document);
        currentRef.current = recovered || document;
        lastSavedRef.current = snapshot(document);
        setSaveState(recovered ? "Unsaved changes" : "Saved online");
        if (recovered)
            showNotice("Recovered unsaved edits from this tab.");
        setMobileScreen("editor");
    }, [showNotice]);
    useEffect(() => {
        let active = true;
        fetch("/api/content", { cache: "no-store" })
            .then(async (response) => {
            const result = (await response.json());
            if (!response.ok)
                throw new Error(result.error || "The writing could not be loaded.");
            return result.documents || [];
        })
            .then((items) => {
            if (!active)
                return;
            const requested = requestedDocument(items);
            let recovery = null;
            try {
                recovery = lastRecoveredDocument(window.sessionStorage);
            }
            catch { /* Storage can be disabled. */ }
            const initial = requested || items.find((item) => item.id === recovery?.id) || recovery || items[0];
            setDocuments(items);
            setSaveState("Saved online");
            if (initial) {
                let recovered = null;
                try {
                    recovered = recoverEdits(window.sessionStorage, initial);
                }
                catch { /* Storage can be disabled. */ }
                setCurrent(recovered || initial);
                currentRef.current = recovered || initial;
                lastSavedRef.current = snapshot(items.find((item) => item.id === initial.id) || null);
                setSaveState(recovered ? "Unsaved changes" : "Saved online");
                if (recovered)
                    showNotice("Recovered unsaved edits from this tab.");
            }
            if (requested) {
                setMobileScreen("editor");
                clearDocumentRequest();
            }
        })
            .catch((error) => {
            if (!active)
                return;
            setSaveState("Could not save");
            showNotice(error.message);
        });
        return () => {
            active = false;
        };
    }, [showNotice]);
    const replaceInLibrary = useCallback((saved, previousId) => {
        setDocuments((items) => {
            const index = items.findIndex((item) => item.id === previousId || item.id === saved.id);
            if (index === -1)
                return [saved, ...items];
            const next = [...items];
            next[index] = saved;
            return next;
        });
    }, []);
    const applySyncedDocument = useCallback((saved, previousId = saved.id) => {
        saved = withEditBase(saved);
        replaceInLibrary(saved, previousId);
        const active = currentRef.current;
        if (active?.id === previousId || active?.id === saved.id) {
            if (snapshot(active) !== lastSavedRef.current)
                return;
            setCurrent(saved);
            currentRef.current = saved;
            lastSavedRef.current = snapshot(saved);
            setSaveState("Saved online");
        }
    }, [replaceInLibrary]);
    const syncOne = useCallback(async (id, resolution = "auto", quiet = false) => {
        if (!driveConnected)
            return null;
        setSyncing(true);
        try {
            let requestedResolution = resolution;
            while (true) {
                const response = await fetch("/api/content/drive", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "sync", id, resolution: requestedResolution }),
                });
                const result = (await response.json());
                if (response.status === 409 && result.state === "conflict") {
                    if (quiet)
                        return null;
                    const keepStudio = window.confirm("This piece changed in both Studio and Google Docs. Choose OK to keep your Studio version and update Google Docs, or Cancel to leave both versions unchanged.");
                    if (!keepStudio) {
                        showNotice("Nothing was changed.");
                        return null;
                    }
                    requestedResolution = "studio";
                    continue;
                }
                if (!response.ok || !result.document) {
                    throw new Error(result.error || "Google Docs could not finish syncing.");
                }
                applySyncedDocument(result.document, id);
                if (!quiet) {
                    const message = result.state === "pulled"
                        ? "Brought in the latest Google Docs changes."
                        : result.state === "created"
                            ? "Created this draft in Google Docs."
                            : result.state === "pushed"
                                ? "Saved the latest Studio changes to Google Docs."
                                : "Studio and Google Docs are in sync.";
                    showNotice(message);
                }
                return result.document;
            }
        }
        catch (error) {
            if (!quiet)
                showNotice(error instanceof Error ? error.message : "Google Docs could not finish syncing.");
            return null;
        }
        finally {
            setSyncing(false);
        }
    }, [applySyncedDocument, driveConnected, showNotice]);
    const discoverDocuments = useCallback(async (quiet = false) => {
        if (!driveConnected)
            return;
        setSyncing(true);
        try {
            const response = await fetch("/api/content/drive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "discover" }),
            });
            const result = (await response.json());
            if (!response.ok || !result.documents) {
                throw new Error(result.error || "Google Docs could not finish syncing.");
            }
            setDocuments(result.documents);
            const active = currentRef.current;
            const refreshed = active
                ? result.documents.find((item) => item.id === active.id)
                : result.documents[0];
            if (refreshed)
                applySyncedDocument(refreshed);
            if (!quiet)
                showNotice("Checked Google Docs for new pieces.");
        }
        catch (error) {
            if (!quiet)
                showNotice(error instanceof Error ? error.message : "Google Docs could not finish syncing.");
        }
        finally {
            setSyncing(false);
        }
    }, [applySyncedDocument, driveConnected, showNotice]);
    useEffect(() => {
        fetch("/api/content/drive", { cache: "no-store" })
            .then(async (response) => response.ok
            ? await response.json()
            : { configured: false })
            .then((result) => setDriveConnected(Boolean(result.configured)))
            .catch(() => setDriveConnected(false));
    }, []);
    useEffect(() => {
        if (!driveConnected || !documents.length || driveDiscoveryRanRef.current)
            return;
        driveDiscoveryRanRef.current = true;
        const timer = window.setTimeout(() => void discoverDocuments(true), 0);
        return () => window.clearTimeout(timer);
    }, [documents.length, discoverDocuments, driveConnected]);
    const persistCurrent = useCallback(async () => {
        if (publishingRef.current)
            return null;
        saveQueueRef.current ||= createSaveQueue({
            current: () => currentRef.current,
            needsSave: (document) => Boolean(document.title.trim()) && snapshot(document) !== lastSavedRef.current,
            save: async (saving) => {
                setSaveState("Saving…");
                const response = await fetch("/api/content/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(saving),
                });
                const result = (await response.json());
                if (!response.ok || !result.document) {
                    throw new Error(result.error || "The draft could not be saved.");
                }
                return result.document;
            },
            acknowledge: (saving, saved) => {
                const latest = currentRef.current;
                replaceInLibrary(saved, saving.id);
                if (latest && latest.id === saving.id) {
                    const unchanged = snapshot(latest) === snapshot(saving);
                    const acknowledged = unchanged ? saved : acknowledgeSave(latest, saving, saved);
                    setCurrent(acknowledged);
                    currentRef.current = acknowledged;
                    lastSavedRef.current = snapshot(saved);
                    try {
                        forgetEdits(window.sessionStorage, saving.id);
                        if (unchanged)
                            forgetEdits(window.sessionStorage, saved.id);
                        else
                            rememberEdits(window.sessionStorage, acknowledged);
                    }
                    catch { /* Do not turn a successful server save into a storage error. */ }
                    setSaveState(unchanged ? "Saved online" : "Unsaved changes");
                }
            },
            failed: (error) => {
                setSaveState("Could not save");
                showNotice(error instanceof Error ? error.message : "The draft could not be saved.");
            },
        });
        return saveQueueRef.current();
    }, [replaceInLibrary, showNotice]);
    useEffect(() => {
        if (publishing)
            return;
        if (!current || !current.title.trim())
            return;
        if (snapshot(current) === lastSavedRef.current)
            return;
        setSaveState("Unsaved changes");
        const timer = window.setTimeout(() => void persistCurrent(), 1400);
        return () => window.clearTimeout(timer);
    }, [current, persistCurrent, publishing]);
    const updateCurrent = useCallback((patch) => {
        setCurrent((document) => {
            if (!document)
                return document;
            const next = { ...document, ...patch, isDirty: true };
            currentRef.current = next;
            try {
                rememberEdits(window.sessionStorage, next);
            }
            catch { /* Unload warning remains available. */ }
            return next;
        });
    }, []);
    const beginNewPost = async () => {
        if (currentRef.current && !(await persistCurrent()))
            return;
        const document = newPost();
        setCurrent(document);
        currentRef.current = document;
        lastSavedRef.current = "";
        setMobileScreen("editor");
        setSaveState("Unsaved changes");
    };
    const beginNewNow = async () => {
        if (currentRef.current && !(await persistCurrent()))
            return;
        const document = newPost("now");
        setCurrent(document);
        currentRef.current = document;
        lastSavedRef.current = "";
        setMobileScreen("editor");
        setSaveState("Unsaved changes");
    };
    const chooseDocument = async (document) => {
        if (currentRef.current && !(await persistCurrent()))
            return;
        selectDocument(document);
    };
    const reorderDrafts = async (sourceId, targetId) => {
        const drafts = documents.filter((document) => document.type === "post" && document.status === "draft");
        const reordered = moveItemToTarget(drafts, sourceId, targetId);
        if (reordered === drafts)
            return;
        const previousDocuments = documents;
        let draftIndex = 0;
        const nextDocuments = documents.map((document) => document.type === "post" && document.status === "draft"
            ? reordered[draftIndex++]
            : document);
        setDocuments(nextDocuments);
        try {
            const response = await fetch("/api/content/reorder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: reordered.map((document) => document.id) }),
            });
            const result = (await response.json());
            if (!response.ok)
                throw new Error(result.error || "The drafts could not be reordered.");
        }
        catch (error) {
            setDocuments(previousDocuments);
            showNotice(error instanceof Error ? error.message : "The drafts could not be reordered.");
        }
    };
    const publishSavedDocument = async (document) => {
        publishingRef.current = true;
        setPublishing(true);
        setSaveState("Saving…");
        try {
            const response = await fetch("/api/content/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: document.id }),
            });
            const result = (await response.json());
            if (!response.ok || !result.document) {
                throw new Error(result.error || "Publishing did not finish.");
            }
            replaceInLibrary(result.document, document.id);
            const latest = currentRef.current;
            const changedWhilePublishing = latest?.id === document.id && snapshot(latest) !== snapshot(document);
            const acknowledged = changedWhilePublishing ? acknowledgeSave(latest, document, result.document) : result.document;
            setCurrent(acknowledged);
            currentRef.current = acknowledged;
            lastSavedRef.current = snapshot(result.document);
            setSaveState(changedWhilePublishing ? "Unsaved changes" : "Saved online");
            try {
                if (changedWhilePublishing)
                    rememberEdits(window.sessionStorage, acknowledged);
                else
                    forgetEdits(window.sessionStorage, document.id);
            }
            catch { /* Keep the editor usable if browser storage is unavailable. */ }
            showNotice(result.document.status === "draft"
                ? "Moved to drafts. Write Placid is updating."
                : "Published. Write Placid is updating.");
            if (result.document.status === "published")
                void waitForLive(result.document);
        }
        catch (error) {
            setSaveState("Could not save");
            showNotice(error instanceof Error ? error.message : "Publishing did not finish.");
            return false;
        }
        finally {
            publishingRef.current = false;
            setPublishing(false);
        }
        return true;
    };
    const waitForLive = async (document) => {
        const pollId = ++livePollRef.current;
        for (let attempt = 0; attempt < 18; attempt += 1) {
            if (attempt)
                await new Promise((resolve) => window.setTimeout(resolve, 5000));
            if (pollId !== livePollRef.current)
                return;
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch(`/api/content/live?id=${encodeURIComponent(document.id)}`, {
                    cache: "no-store",
                    signal: controller.signal,
                });
                const result = (await response.json());
                if (response.ok && result.live) {
                    if (snapshot(currentRef.current) === lastSavedRef.current)
                        setSaveState("Saved online");
                    showNotice(`Live now${document.type !== "page" ? ` — ${displayDate(document.date)}` : ""}.`);
                    return;
                }
            }
            catch {
                // Keep checking while the public site rebuilds.
            }
            finally {
                window.clearTimeout(timeout);
            }
        }
        if (pollId === livePollRef.current) {
            if (snapshot(currentRef.current) === lastSavedRef.current)
                setSaveState("Saved online");
            showNotice("Published to GitHub. The public site is still finishing its update.");
        }
    };
    const publishCurrent = async () => {
        let document = await persistCurrent();
        if (!document || publishingRef.current)
            return;
        document = currentRef.current || document;
        if (!document.body.trim()) {
            showNotice("There is nothing to publish yet.");
            return;
        }
        const isDraft = document.type !== "page" && document.status === "draft";
        const action = isDraft
            ? document.type === "now"
                ? "Publish this Now update?"
                : `Publish “${document.title}”?`
            : `Publish the latest changes to “${document.title}”?`;
        if (!window.confirm(action))
            return;
        const previous = document;
        if (isDraft) {
            const next = {
                ...document,
                status: "published",
                publishedAt: document.publishedAt || new Date().toISOString(),
                isDirty: true,
            };
            setCurrent(next);
            currentRef.current = next;
            replaceInLibrary(next, document.id);
            const saved = await persistCurrent();
            if (!saved) {
                const restored = { ...(currentRef.current || next), status: previous.status, publishedAt: previous.publishedAt };
                setCurrent(restored);
                currentRef.current = restored;
                replaceInLibrary(restored, restored.id);
                try {
                    rememberEdits(window.sessionStorage, restored);
                }
                catch { /* Keep edits in memory. */ }
                return;
            }
            document = saved;
        }
        const published = await publishSavedDocument(currentRef.current || document);
        if (published || !isDraft)
            return;
        const restored = {
            ...(currentRef.current || document),
            status: "draft",
            publishedAt: previous.publishedAt,
            isDirty: true,
        };
        setCurrent(restored);
        currentRef.current = restored;
        replaceInLibrary(restored, restored.id);
        await persistCurrent();
    };
    const moveToDraft = async () => {
        if (!current || current.type === "page" || current.status !== "published")
            return;
        if (!window.confirm(`Move “${current.title}” to Draft and remove it from the live site?`))
            return;
        const previous = current;
        const next = { ...current, status: "draft", isDirty: true };
        setCurrent(next);
        currentRef.current = next;
        replaceInLibrary(next, current.id);
        const saved = await persistCurrent();
        if (saved && await publishSavedDocument(currentRef.current || saved))
            return;
        const restored = { ...previous, kdrivePath: currentRef.current?.kdrivePath, kdriveEtag: currentRef.current?.kdriveEtag, isDirty: true };
        setCurrent(restored);
        currentRef.current = restored;
        replaceInLibrary(restored, previous.id);
        await persistCurrent();
    };
    const deleteCurrent = async () => {
        const document = currentRef.current;
        if (!document || document.type === "page" || document.id.startsWith("new:"))
            return;
        const confirmed = window.confirm(`Delete “${document.title}”? A private recovery copy will be kept.`);
        if (!confirmed)
            return;
        setDeleting(true);
        setSaveState("Deleting…");
        try {
            const response = await fetch("/api/content/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: document.id }),
            });
            const result = (await response.json());
            if (!response.ok)
                throw new Error(result.error || "The piece could not be deleted.");
            const remaining = documents.filter((item) => item.id !== document.id);
            const next = remaining[0] || null;
            setDocuments(remaining);
            setCurrent(next);
            currentRef.current = next;
            lastSavedRef.current = snapshot(next);
            setSaveState("Saved online");
            showNotice(result.removedFromGithub
                ? `Deleted “${document.title}”. Write Placid is updating.`
                : `Deleted “${document.title}”.`);
        }
        catch (error) {
            setSaveState("Could not save");
            showNotice(error instanceof Error ? error.message : "The piece could not be deleted.");
        }
        finally {
            setDeleting(false);
        }
    };
    const applyItalic = () => {
        if (!current || !bodyRef.current)
            return;
        bodyRef.current.focus();
        document.execCommand("italic", false);
        updateCurrent({ body: editorToMarkdown(bodyRef.current) });
    };
    const applySectionHeading = () => {
        if (!current || !bodyRef.current)
            return;
        bodyRef.current.focus();
        document.execCommand("formatBlock", false, "h2");
        updateCurrent({ body: editorToMarkdown(bodyRef.current) });
    };
    const applyBlockQuote = () => {
        const editor = bodyRef.current;
        if (!current || !editor)
            return;
        editor.focus();
        const selection = window.getSelection();
        const selectedElement = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
            ? selection.anchorNode
            : selection?.anchorNode?.parentElement;
        const selectedQuote = selectedElement?.closest("blockquote");
        document.execCommand("formatBlock", false, selectedQuote && editor.contains(selectedQuote) ? "p" : "blockquote");
        updateCurrent({ body: editorToMarkdown(editor) });
    };
    const openExistingLink = (anchor) => {
        const editor = bodyRef.current;
        if (!current || !editor?.contains(anchor))
            return;
        const range = document.createRange();
        range.selectNodeContents(anchor);
        linkSelectionRef.current = range;
        editingLinkRef.current = anchor;
        setLinkMode("edit");
        setLinkLabel(anchor.textContent || "");
        setLinkHref(anchor.getAttribute("href") || "");
        setLinkOpen(true);
    };
    const openLink = () => {
        if (!current || !bodyRef.current)
            return;
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        if (!range || !bodyRef.current.contains(range.commonAncestorContainer)) {
            showNotice("Select some text to link first.");
            return;
        }
        const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer
            : range.startContainer.parentElement;
        const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
            ? range.endContainer
            : range.endContainer.parentElement;
        const existingLink = startElement?.closest("a");
        if (existingLink && existingLink === endElement?.closest("a")) {
            openExistingLink(existingLink);
            return;
        }
        linkSelectionRef.current = range.cloneRange();
        editingLinkRef.current = null;
        setLinkMode("add");
        setLinkLabel(range.toString());
        setLinkHref("");
        setLinkOpen(true);
    };
    const closeLinkDialog = () => {
        const range = linkSelectionRef.current?.cloneRange();
        setLinkOpen(false);
        linkSelectionRef.current = null;
        editingLinkRef.current = null;
        window.requestAnimationFrame(() => {
            const editor = bodyRef.current;
            if (!editor)
                return;
            editor.focus({ preventScroll: true });
            if (range && editor.contains(range.commonAncestorContainer)) {
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);
            }
        });
    };
    const saveLink = () => {
        if (!current || !linkLabel.trim() || !isSafeHref(linkHref.trim())) {
            showNotice("Use a complete web address, email link, or site path.");
            return;
        }
        const editor = bodyRef.current;
        const range = linkSelectionRef.current;
        if (!editor || !range)
            return;
        const existingLink = editingLinkRef.current;
        if (linkMode === "edit" && existingLink && editor.contains(existingLink)) {
            const nextLabel = linkLabel.trim();
            if (existingLink.textContent !== nextLabel)
                existingLink.textContent = nextLabel;
            existingLink.setAttribute("href", linkHref.trim());
            existingLink.setAttribute("target", "_blank");
            existingLink.setAttribute("rel", "noreferrer");
            updateCurrent({ body: editorToMarkdown(editor) });
            closeLinkDialog();
            return;
        }
        const anchor = document.createElement("a");
        anchor.href = linkHref.trim();
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
        if (range.toString() === linkLabel.trim()) {
            anchor.appendChild(range.extractContents());
        }
        else {
            range.deleteContents();
            anchor.textContent = linkLabel.trim();
        }
        range.insertNode(anchor);
        range.setStartAfter(anchor);
        range.collapse(true);
        updateCurrent({ body: editorToMarkdown(editor) });
        closeLinkDialog();
    };
    const removeLink = () => {
        const editor = bodyRef.current;
        const existingLink = editingLinkRef.current;
        if (!editor || !existingLink || !editor.contains(existingLink))
            return;
        existingLink.replaceWith(...Array.from(existingLink.childNodes));
        updateCurrent({ body: editorToMarkdown(editor) });
        closeLinkDialog();
    };
    const openImage = (figure = null, trigger = figure) => {
        const editor = bodyRef.current;
        if (!current || !editor)
            return;
        const existing = figure && editor.contains(figure) ? readEditorImage(figure) : null;
        if (figure && !existing)
            return;
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        imageSelectionRef.current = range && editor.contains(range.commonAncestorContainer)
            ? range.cloneRange()
            : null;
        setImageFile(null);
        editingImageRef.current = existing ? figure : null;
        imageReturnFocusRef.current = existing ? trigger : null;
        setImageMode(existing ? "edit" : "add");
        setImageAlt(existing?.alt || "");
        setImageCaption(existing?.title || "");
        setImageOpen(true);
    };
    const finishImageDialog = () => {
        const range = imageSelectionRef.current?.cloneRange();
        const focusTarget = imageReturnFocusRef.current || editingImageRef.current;
        imageReturnFocusRef.current = null;
        setImageOpen(false);
        imageSelectionRef.current = null;
        editingImageRef.current = null;
        window.requestAnimationFrame(() => {
            const editor = bodyRef.current;
            if (!editor)
                return;
            if (range && editor.contains(range.commonAncestorContainer)) {
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);
            }
            (focusTarget && editor.contains(focusTarget) ? focusTarget : editor).focus({ preventScroll: true });
        });
    };
    const closeImageDialog = () => {
        if (!imageUploading)
            finishImageDialog();
    };
    const saveImage = async () => {
        const editor = bodyRef.current;
        const active = currentRef.current;
        if (!editor || !active || !imageAlt.trim()) {
            showNotice("Describe what the image shows.");
            return;
        }
        const details = { alt: imageAlt.trim(), title: imageCaption.trim() || undefined };
        if (imageMode === "edit") {
            const figure = editingImageRef.current;
            if (!figure || !editor.contains(figure) || !updateEditorImage(figure, details)) {
                showNotice("That image is no longer in this piece. Close this dialog and select it again.");
                return;
            }
            updateCurrent({ body: editorToMarkdown(editor) });
            finishImageDialog();
            showNotice("Image details updated.");
            return;
        }
        if (!imageFile) {
            showNotice("Choose an image first.");
            return;
        }
        setImageUploading(true);
        try {
            const form = new FormData();
            form.set("image", imageFile);
            form.set("slug", active.slug || active.title);
            const response = await fetch("/api/content/image", { method: "POST", body: form });
            const result = (await response.json());
            if (!response.ok || !result.src)
                throw new Error(result.error || "The image could not be added.");
            if (!currentRef.current || (currentRef.current.id !== active.id && !active.id.startsWith("new:"))) {
                throw new Error("The open piece changed while the image was uploading. Open it again to add the image.");
            }
            const markdown = articleImageMarkdown({
                ...details,
                src: result.src,
            });
            const container = document.createElement("div");
            container.innerHTML = markdownToEditorHtml(markdown);
            const imageBlock = container.firstElementChild;
            if (!imageBlock)
                throw new Error("The image could not be placed in the editor.");
            const spacer = document.createElement("p");
            spacer.appendChild(document.createElement("br"));
            const range = imageSelectionRef.current;
            const rangeElement = range?.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
                ? range.commonAncestorContainer
                : range?.commonAncestorContainer.parentElement;
            const block = rangeElement?.closest(".editor-image-block") || rangeElement?.closest("p, h2, blockquote, ul, ol, figure");
            if (block && block.parentElement === editor) {
                editor.insertBefore(imageBlock, block.nextSibling);
                editor.insertBefore(spacer, imageBlock.nextSibling);
            }
            else {
                editor.appendChild(imageBlock);
                editor.appendChild(spacer);
            }
            updateCurrent({ body: editorToMarkdown(editor) });
            finishImageDialog();
            showNotice("Image added to this draft.");
        }
        catch (error) {
            showNotice(error instanceof Error ? error.message : "The image could not be added.");
        }
        finally {
            setImageUploading(false);
        }
    };
    const handleEditorClick = (event) => {
        const element = event.target instanceof Element ? event.target : null;
        const figure = element?.closest(".editor-image-block")?.querySelector("figure.article-image") || element?.closest("figure.article-image");
        if (figure) {
            event.preventDefault();
            openImage(figure, element?.closest("[data-editor-image-control]") || figure);
            return;
        }
        const target = element?.closest("a");
        if (!target)
            return;
        event.preventDefault();
        openExistingLink(target);
    };
    const convertNumberedListShortcut = () => {
        const editor = bodyRef.current;
        const selection = window.getSelection();
        if (!editor || !selection?.rangeCount || !selection.isCollapsed)
            return false;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer))
            return false;
        const anchorElement = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
            ? selection.anchorNode
            : selection.anchorNode?.parentElement;
        const closestBlock = anchorElement?.closest("p, div");
        const block = closestBlock && closestBlock !== editor ? closestBlock : selection.anchorNode;
        if (!block || block.textContent === null)
            return false;
        const start = numberedListShortcutStart(block.textContent);
        if (start === null)
            return false;
        const markerRange = document.createRange();
        markerRange.selectNodeContents(block);
        markerRange.deleteContents();
        markerRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(markerRange);
        document.execCommand("insertOrderedList", false);
        const selectedElement = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
            ? selection.anchorNode
            : selection.anchorNode?.parentElement;
        const list = selectedElement?.closest("ol");
        if (list && start !== 1)
            list.setAttribute("start", String(start));
        return true;
    };
    const handleEditorInput = () => {
        if (!bodyRef.current)
            return;
        convertNumberedListShortcut();
        updateCurrent({ body: editorToMarkdown(bodyRef.current) });
    };
    const handleEditorPaste = (event) => {
        event.preventDefault();
        const text = smartenQuotes(event.clipboardData.getData("text/plain"));
        const richHtml = markdownPasteToEditorHtml(text);
        document.execCommand(richHtml ? "insertHTML" : "insertText", false, richHtml || text);
        handleEditorInput();
    };
    const insertSmartQuote = (quote) => {
        const editor = bodyRef.current;
        const selection = window.getSelection();
        if (!editor || !selection?.rangeCount)
            return false;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer))
            return false;
        const before = range.cloneRange();
        before.selectNodeContents(editor);
        before.setEnd(range.startContainer, range.startOffset);
        const nextCharacter = smartQuoteForInput(quote, before.toString().slice(-1));
        range.deleteContents();
        const text = document.createTextNode(nextCharacter);
        range.insertNode(text);
        range.setStartAfter(text);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        handleEditorInput();
        return true;
    };
    const handleEditorBeforeInput = (event) => {
        const inputEvent = event.nativeEvent;
        if (inputEvent.inputType !== "insertText")
            return;
        if (inputEvent.data !== "\"" && inputEvent.data !== "'")
            return;
        if (!insertSmartQuote(inputEvent.data))
            return;
        event.preventDefault();
    };
    const handleEditorKeyDown = (event) => {
        const element = event.target instanceof Element ? event.target : null;
        const figure = element?.closest(".editor-image-block")?.querySelector("figure.article-image") || element?.closest("figure.article-image");
        if (figure && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openImage(figure, element?.closest("[data-editor-image-control]") || figure);
            return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
            event.preventDefault();
            applyItalic();
            return;
        }
        if (event.key !== "\"" && event.key !== "'")
            return;
        if (insertSmartQuote(event.key))
            event.preventDefault();
    };
    const handleDialogKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeLinkDialog();
            return;
        }
        if (event.key !== "Tab" || !linkDialogRef.current)
            return;
        const controls = Array.from(linkDialogRef.current.querySelectorAll("input, button:not(:disabled)"));
        if (!controls.length)
            return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };
    const handleImageDialogKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeImageDialog();
            return;
        }
        if (event.key !== "Tab" || !imageDialogRef.current)
            return;
        const controls = Array.from(imageDialogRef.current.querySelectorAll('input:not(:disabled), button:not(:disabled), [contenteditable="true"]'));
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus({ preventScroll: true });
        }
        else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus({ preventScroll: true });
        }
    };
    const grouped = useMemo(() => ({
        pages: documents.filter((document) => document.type === "page"),
        now: documents.filter((document) => document.type === "now")
            .sort((left, right) => (right.publishedAt || right.date).localeCompare(left.publishedAt || left.date)),
        drafts: documents.filter((document) => document.type === "post" && document.status === "draft"),
        published: documents.filter((document) => document.type === "post" && document.status === "published").sort((left, right) => right.date.localeCompare(left.date)),
    }), [documents]);
    const publishLabel = publishing
        ? "Publishing…"
        : !current
            ? "Publish"
            : current.status === "draft"
                ? "Publish"
                : current.isDirty
                    ? "Update"
                    : "Republish";
    const publishDisabled = !current?.title.trim() ||
        !current.body.trim() ||
        publishing;
    return (_jsxs("main", { className: "studio-shell", children: [_jsxs("header", { className: "studio-header", children: [_jsx("button", { className: "mobile-back", type: "button", onClick: async () => {
                            await persistCurrent();
                            setMobileScreen("library");
                        }, "aria-label": "Back to writing", children: "Writing" }), _jsxs("div", { className: "studio-title", children: [studioConfig.publicationName, " ", _jsx("span", { children: "Studio" })] }), _jsxs("div", { className: "editor-header", children: [_jsx("div", { className: "save-state", "aria-live": "polite", children: saveState }), _jsxs("div", { className: "header-actions", children: [_jsx("a", { href: studioConfig.siteUrl, target: "_blank", rel: "noreferrer", children: "View live" }), driveConnected ? (_jsx("button", { className: "sync-button", type: "button", onClick: async () => {
                                            if (!current) {
                                                await discoverDocuments();
                                                return;
                                            }
                                            const saved = await persistCurrent();
                                            const active = currentRef.current || saved;
                                            if (active)
                                                await syncOne(active.id);
                                        }, disabled: syncing, "aria-label": "Sync with Google Docs", title: "Sync with Google Docs", children: syncing ? "…" : "↻" })) : null, _jsxs("button", { className: "theme-toggle", type: "button", onClick: toggleTheme, "aria-label": "Toggle day and night mode", title: "Toggle day and night mode", children: [_jsx("span", { className: "theme-sun", "aria-hidden": "true", children: "\u2600\uFE0E" }), _jsx("span", { className: "theme-moon", "aria-hidden": "true", children: "\u263E" })] }), _jsx("button", { className: "publish-button", type: "button", disabled: publishDisabled, onClick: publishCurrent, children: publishLabel })] })] })] }), _jsxs("aside", { className: `library ${mobileScreen === "library" ? "is-mobile-active" : ""}`, children: [_jsxs("div", { className: "new-actions", children: [_jsxs("button", { className: "new-button", type: "button", onClick: beginNewPost, children: ["New piece ", _jsx("span", { children: "+" })] }), _jsxs("button", { className: "new-button", type: "button", onClick: beginNewNow, children: ["New now ", _jsx("span", { children: "+" })] })] }), _jsxs("nav", { "aria-label": "Writing", children: [_jsx(LibrarySection, { title: "Pages", documents: grouped.pages, selectedId: current?.id || "", onSelect: chooseDocument }), _jsx(LibrarySection, { title: "Now", documents: grouped.now, selectedId: current?.id || "", onSelect: chooseDocument }), _jsx(LibrarySection, { title: "Drafts", documents: grouped.drafts, selectedId: current?.id || "", onSelect: chooseDocument, onReorder: reorderDrafts }), _jsx(LibrarySection, { title: "Published", documents: grouped.published, selectedId: current?.id || "", onSelect: chooseDocument })] })] }), _jsx("section", { className: `workspace ${mobileScreen === "editor" ? "is-mobile-active" : ""}`, children: current ? (_jsx(_Fragment, { children: _jsxs("div", { className: "editor", children: [_jsxs("div", { className: "editor-meta", children: [_jsx("button", { className: `post-state ${current.status === "published" ? "is-published" : ""}`, type: "button", disabled: true, children: current.type === "page"
                                            ? "Page"
                                            : current.type === "now"
                                                ? current.status === "published" ? "Now · Published" : "Now · Draft"
                                                : current.status === "published" ? "Published" : "Draft" }), current.type !== "page" ? (_jsxs("div", { className: "post-dates", children: [_jsxs("label", { children: [_jsx("span", { children: current.type === "post" ? "Post date" : "Date" }), _jsx("input", { "aria-label": current.type === "post" ? "Post date" : "Date", type: "date", value: current.date, onChange: (event) => updateCurrent({ date: event.target.value }) })] }), current.type === "post" && current.publicUpdatedAt ? (_jsxs("span", { className: "modified-date", children: ["Last edited ", displayDate(current.publicUpdatedAt.slice(0, 10))] })) : null] })) : null, current.type !== "page" && !current.id.startsWith("new:") ? (_jsxs(_Fragment, { children: [current.status === "published" ? (_jsx("button", { className: "draft-button", type: "button", disabled: publishing || deleting, onClick: moveToDraft, children: "Move to draft" })) : null, _jsx("button", { className: "delete-button", type: "button", disabled: publishing || deleting, onClick: deleteCurrent, children: deleting ? "Deleting…" : "Delete" })] })) : null] }), _jsx("label", { className: "sr-only", htmlFor: "title-input", children: "Title" }), _jsx("textarea", { id: "title-input", className: "title-input", rows: 2, value: current.title, placeholder: current.type === "now" ? "Now" : "Untitled", readOnly: current.type === "now", onChange: (event) => updateCurrent({ title: smartenQuotes(event.target.value) }) }), current.type === "post" && !current.id.startsWith("new:") ? (_jsxs("details", { className: "editorial-details", children: [_jsx("summary", { children: "Public address and folder" }), _jsx("label", { htmlFor: "slug-input", children: "Public slug" }), _jsx("input", { id: "slug-input", defaultValue: current.slug, onBlur: (event) => { if (event.target.value !== current.slug)
                                            updateCurrent({ slug: event.target.value }); } }, `${current.id}:${current.slug}`), _jsx("p", { children: new URL(`${current.slug}.html`, `${studioConfig.siteUrl.replace(/\/$/, "")}/`).href }), _jsx("p", { children: "Changing the title or folder keeps this address. A new slug keeps the previous address as a redirect." }), _jsxs("p", { children: ["Folder: ", current.kdrivePath?.split("/").slice(0, -1).join("/") || "Drafts"] }), current.aliases?.length ? _jsxs("p", { children: ["Former addresses: ", current.aliases.join(", ")] }) : null] })) : null, _jsxs("div", { className: "formatting-toolbar", "aria-label": "Text formatting", children: [_jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: applySectionHeading, "aria-label": "Section heading", title: "Section heading", children: _jsx(Heading2, { "aria-hidden": "true", size: 18, strokeWidth: 1.75 }) }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: applyBlockQuote, "aria-label": "Block quote", title: "Block quote", children: _jsx(QuoteIcon, { "aria-hidden": "true", size: 17, strokeWidth: 1.75 }) }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: applyItalic, "aria-label": "Italic", title: "Italic", children: _jsx(Italic, { "aria-hidden": "true", size: 17, strokeWidth: 1.75 }) }), _jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: openLink, "aria-label": "Add link", title: "Add link", children: _jsx(LinkIcon, { "aria-hidden": "true", size: 17, strokeWidth: 1.75 }) }), current.type === "post" ? (_jsx("button", { type: "button", onMouseDown: (event) => event.preventDefault(), onClick: () => openImage(), "aria-label": "Add image", title: "Add image", children: _jsx(ImageIcon, { "aria-hidden": "true", size: 17, strokeWidth: 1.75 }) })) : null, _jsx("span", { children: "Select text, then choose a style." })] }), _jsx("label", { className: "sr-only", htmlFor: "body-input", children: "Main text" }), _jsx("div", { ref: bodyRef, id: "body-input", className: "body-input", contentEditable: true, suppressContentEditableWarning: true, role: "textbox", tabIndex: 0, "aria-label": "Main text", "aria-multiline": "true", "data-placeholder": "Begin anywhere.", onBeforeInput: handleEditorBeforeInput, onInput: handleEditorInput, onPaste: handleEditorPaste, onClick: handleEditorClick, onKeyDown: handleEditorKeyDown }), current.type === "post" ? (_jsxs("details", { className: "source-details", open: Boolean(current.source), children: [_jsx("summary", { children: "Source or further reading" }), _jsxs("div", { className: "source-fields", children: [_jsxs("label", { children: [_jsx("span", { children: "Link text" }), _jsx("input", { value: current.source?.label || "", placeholder: "Read the original piece", onChange: (event) => updateCurrent({
                                                            source: {
                                                                label: smartenQuotes(event.target.value),
                                                                href: current.source?.href || "",
                                                            },
                                                        }) })] }), _jsxs("label", { children: [_jsx("span", { children: "Web address" }), _jsx("input", { type: "url", inputMode: "url", value: current.source?.href || "", placeholder: "https://", onChange: (event) => updateCurrent({
                                                            source: {
                                                                label: current.source?.label || "",
                                                                href: event.target.value,
                                                            },
                                                        }) })] })] })] })) : null] }) })) : (_jsxs("div", { className: "empty-state", children: [_jsx("p", { children: saveState === "Loading…" ? "Loading the writing…" : "No writing yet." }), _jsx("button", { type: "button", onClick: beginNewPost, children: "Start a new piece" })] })) }), linkOpen ? (_jsxs("div", { className: "dialog-backdrop", children: [_jsx("button", { className: "dialog-dismiss", type: "button", "aria-label": "Close link dialog", onClick: closeLinkDialog }), _jsxs("section", { ref: linkDialogRef, className: "link-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "link-title", children: [_jsx("h2", { id: "link-title", children: linkMode === "edit" ? "Edit link" : "Add a link" }), _jsxs("label", { children: [_jsx("span", { children: "Text" }), _jsx("input", { ref: linkTextRef, value: linkLabel, onChange: (event) => setLinkLabel(smartenQuotes(event.target.value)), onKeyDown: handleDialogKeyDown })] }), _jsxs("label", { children: [_jsx("span", { children: "Web address" }), _jsx("input", { value: linkHref, onChange: (event) => setLinkHref(event.target.value), inputMode: "url", placeholder: "https://", onKeyDown: handleDialogKeyDown })] }), _jsxs("label", { htmlFor: "internal-link", children: ["Or link to a ", studioConfig.publicationName, " piece"] }), _jsxs("select", { id: "internal-link", value: "", onChange: (event) => {
                                    const target = documents.find((item) => item.id === event.target.value);
                                    if (target) {
                                        setLinkHref(`doc:${encodeURIComponent(target.id)}`);
                                        if (!linkLabel)
                                            setLinkLabel(target.title);
                                    }
                                }, children: [_jsx("option", { value: "", children: "Choose a piece" }), documents.filter((item) => item.id !== current?.id).map((item) => _jsx("option", { value: item.id, children: item.title }, item.id))] }), _jsxs("div", { className: "dialog-actions", children: [linkMode === "edit" ? (_jsx("button", { className: "remove-link-button", type: "button", onClick: removeLink, onKeyDown: handleDialogKeyDown, children: "Remove link" })) : null, _jsx("button", { type: "button", onClick: closeLinkDialog, onKeyDown: handleDialogKeyDown, children: "Cancel" }), _jsx("button", { type: "button", onClick: saveLink, onKeyDown: handleDialogKeyDown, children: linkMode === "edit" ? "Update link" : "Add link" })] })] })] })) : null, imageOpen ? (_jsxs("div", { className: "dialog-backdrop", children: [_jsx("button", { className: "dialog-dismiss", type: "button", "aria-label": "Close image dialog", onClick: closeImageDialog }), _jsxs("section", { ref: imageDialogRef, className: "link-dialog image-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "image-title", onKeyDown: handleImageDialogKeyDown, children: [_jsx("h2", { id: "image-title", children: imageMode === "edit" ? "Edit image" : "Add an image" }), imageMode === "add" ? _jsxs("label", { children: [_jsx("span", { children: "Image file" }), _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif", disabled: imageUploading, onChange: (event) => setImageFile(event.target.files?.[0] || null) })] }) : null, _jsxs("label", { children: [_jsx("span", { children: "Image description" }), _jsx("input", { ref: imageAltRef, value: imageAlt, onChange: (event) => setImageAlt(event.target.value), placeholder: "What the image shows", disabled: imageUploading, "aria-describedby": "image-description-help" })] }), _jsx("p", { id: "image-description-help", children: "Describe the image for people using screen readers." }), _jsx(CaptionEditor, { value: imageCaption, onChange: setImageCaption, disabled: imageUploading }), imageMode === "add" ? _jsx("p", { children: "JPEG, PNG, WebP, or GIF \u00B7 8 MB maximum" }) : null, _jsxs("div", { className: "dialog-actions", children: [_jsx("button", { type: "button", onClick: closeImageDialog, disabled: imageUploading, children: "Cancel" }), _jsx("button", { type: "button", onClick: saveImage, disabled: imageUploading, children: imageUploading ? "Adding…" : imageMode === "edit" ? "Save image" : "Add image" })] })] })] })) : null, _jsx("div", { className: `notice ${notice ? "is-visible" : ""}`, role: "status", "aria-live": "polite", children: notice })] }));
}
//# sourceMappingURL=Studio.js.map