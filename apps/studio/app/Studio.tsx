"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Heading2, Italic, Link as LinkIcon, Quote as QuoteIcon } from "lucide-react";
import { displayDate, type WritingDocument } from "./content";
import { editorToMarkdown, markdownToEditorHtml } from "./rich-text";
import { smartenQuotes } from "./smart-quotes";
import { studioConfig } from "./studio-config";

type StudioDocument = WritingDocument & { isDirty?: boolean };
type SaveState =
  | "Loading…"
  | "Saved online"
  | "Unsaved changes"
  | "Saving…"
  | "Deleting…"
  | "Updating live…"
  | "Could not save";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function newPost(type: "post" | "now" = "post"): StudioDocument {
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

function snapshot(document: StudioDocument | null) {
  if (!document) return "";
  return JSON.stringify({
    id: document.id,
    type: document.type,
    title: document.title,
    date: document.date,
    status: document.status,
    publishedAt: document.publishedAt,
    body: document.body,
    source: document.source,
  });
}

function requestedDocument(documents: StudioDocument[]) {
  const parameters = new URLSearchParams(window.location.search);
  const requestedSlug = parameters.get("slug")?.trim();
  const requestedTitle = parameters.get("title")?.trim();

  return (
    (requestedSlug
      ? documents.find((document) => document.slug === requestedSlug)
      : undefined) ||
    (requestedTitle
      ? documents.find((document) => document.title === requestedTitle)
      : undefined)
  );
}

function clearDocumentRequest() {
  const url = new URL(window.location.href);
  url.searchParams.delete("slug");
  url.searchParams.delete("title");
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function isSafeHref(href: string) {
  if (href.startsWith("/") || href.startsWith("#")) return true;
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

function LibrarySection({
  title,
  documents,
  selectedId,
  onSelect,
}: {
  title: string;
  documents: StudioDocument[];
  selectedId: string;
  onSelect: (document: StudioDocument) => void;
}) {
  if (!documents.length) return null;
  return (
    <section className="library-section">
      <h2>{title}</h2>
      <ol>
        {documents.map((document) => (
          <li key={document.id}>
            <button
              className={document.id === selectedId ? "is-active" : ""}
              type="button"
              onClick={() => onSelect(document)}
            >
              <span>{document.title || "Untitled"}</span>
              <small>
                {document.type === "page" ? "Page" : displayDate(document.date)}
                {document.status === "published" && document.isDirty
                  ? " · Unpublished changes"
                  : ""}
              </small>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Studio() {
  const [documents, setDocuments] = useState<StudioDocument[]>([]);
  const [current, setCurrent] = useState<StudioDocument | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("Loading…");
  const [notice, setNotice] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [mobileScreen, setMobileScreen] = useState<"library" | "editor">("library");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkMode, setLinkMode] = useState<"add" | "edit">("add");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const linkTextRef = useRef<HTMLInputElement>(null);
  const linkDialogRef = useRef<HTMLElement>(null);
  const currentRef = useRef<StudioDocument | null>(null);
  const lastSavedRef = useRef("");
  const saveInFlightRef = useRef<Promise<StudioDocument | null> | null>(null);
  const saveAgainRef = useRef(false);
  const livePollRef = useRef(0);
  const driveDiscoveryRanRef = useRef(false);
  const persistCurrentRef = useRef<() => Promise<StudioDocument | null>>(
    async () => null,
  );
  const linkSelectionRef = useRef<Range | null>(null);
  const editingLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useLayoutEffect(() => {
    const editor = bodyRef.current;
    if (!editor || !current) return;
    if (editorToMarkdown(editor) === current.body.trim()) return;
    editor.innerHTML = markdownToEditorHtml(current.body);
  }, [current]);

  useEffect(() => {
    if (!linkOpen) return;
    linkTextRef.current?.focus();
  }, [linkOpen]);

  const toggleTheme = () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("write-placid-studio-theme", nextTheme);
  };

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4200);
  }, []);

  const selectDocument = useCallback((document: StudioDocument) => {
    setCurrent(document);
    currentRef.current = document;
    lastSavedRef.current = snapshot(document);
    setSaveState("Saved online");
    setMobileScreen("editor");
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/content", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          documents?: StudioDocument[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error || "The writing could not be loaded.");
        return result.documents || [];
      })
      .then((items) => {
        if (!active) return;
        const requested = requestedDocument(items);
        const initial = requested || items[0];
        setDocuments(items);
        if (initial) {
          setCurrent(initial);
          currentRef.current = initial;
          lastSavedRef.current = snapshot(initial);
        }
        if (requested) {
          setMobileScreen("editor");
          clearDocumentRequest();
        }
        setSaveState("Saved online");
      })
      .catch((error: Error) => {
        if (!active) return;
        setSaveState("Could not save");
        showNotice(error.message);
      });
    return () => {
      active = false;
    };
  }, [showNotice]);

  const replaceInLibrary = useCallback((saved: StudioDocument, previousId: string) => {
    setDocuments((items) => {
      const index = items.findIndex(
        (item) => item.id === previousId || item.id === saved.id,
      );
      if (index === -1) return [saved, ...items];
      const next = [...items];
      next[index] = saved;
      return next;
    });
  }, []);

  const applySyncedDocument = useCallback((saved: StudioDocument, previousId = saved.id) => {
    replaceInLibrary(saved, previousId);
    const active = currentRef.current;
    if (active?.id === previousId || active?.id === saved.id) {
      if (snapshot(active) !== lastSavedRef.current) return;
      setCurrent(saved);
      currentRef.current = saved;
      lastSavedRef.current = snapshot(saved);
      setSaveState("Saved online");
    }
  }, [replaceInLibrary]);

  const syncOne = useCallback(async (
    id: string,
    resolution: "auto" | "drive" | "studio" = "auto",
    quiet = false,
  ): Promise<StudioDocument | null> => {
    if (!driveConnected) return null;
    setSyncing(true);
    try {
      let requestedResolution = resolution;
      while (true) {
        const response = await fetch("/api/content/drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync", id, resolution: requestedResolution }),
        });
        const result = (await response.json()) as {
          state?: "synced" | "pulled" | "pushed" | "conflict" | "created";
          document?: StudioDocument;
          error?: string;
        };
        if (response.status === 409 && result.state === "conflict") {
          if (quiet) return null;
          const keepStudio = window.confirm(
            "This piece changed in both Studio and Google Docs. Choose OK to keep your Studio version and update Google Docs, or Cancel to leave both versions unchanged.",
          );
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
          const message =
            result.state === "pulled"
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
    } catch (error) {
      if (!quiet) showNotice(error instanceof Error ? error.message : "Google Docs could not finish syncing.");
      return null;
    } finally {
      setSyncing(false);
    }
  }, [applySyncedDocument, driveConnected, showNotice]);

  const discoverDocuments = useCallback(async (quiet = false) => {
    if (!driveConnected) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/content/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "discover" }),
      });
      const result = (await response.json()) as {
        documents?: StudioDocument[];
        error?: string;
      };
      if (!response.ok || !result.documents) {
        throw new Error(result.error || "Google Docs could not finish syncing.");
      }
      setDocuments(result.documents);
      const active = currentRef.current;
      const refreshed = active
        ? result.documents.find((item) => item.id === active.id)
        : result.documents[0];
      if (refreshed) applySyncedDocument(refreshed);
      if (!quiet) showNotice("Checked Google Docs for new pieces.");
    } catch (error) {
      if (!quiet) showNotice(error instanceof Error ? error.message : "Google Docs could not finish syncing.");
    } finally {
      setSyncing(false);
    }
  }, [applySyncedDocument, driveConnected, showNotice]);

  useEffect(() => {
    fetch("/api/content/drive", { cache: "no-store" })
      .then(async (response) => response.ok
        ? await response.json() as { configured?: boolean }
        : { configured: false })
      .then((result) => setDriveConnected(Boolean(result.configured)))
      .catch(() => setDriveConnected(false));
  }, []);

  useEffect(() => {
    if (!driveConnected || !documents.length || driveDiscoveryRanRef.current) return;
    driveDiscoveryRanRef.current = true;
    const timer = window.setTimeout(() => void discoverDocuments(true), 0);
    return () => window.clearTimeout(timer);
  }, [documents.length, discoverDocuments, driveConnected]);

  const persistCurrent = useCallback(async (): Promise<StudioDocument | null> => {
    const document = currentRef.current;
    if (!document || !document.title.trim()) return document;
    if (snapshot(document) === lastSavedRef.current) return document;

    if (saveInFlightRef.current) {
      saveAgainRef.current = true;
      await saveInFlightRef.current;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        return persistCurrentRef.current();
      }
      return currentRef.current;
    }

    const saving = { ...document };
    const savingSnapshot = snapshot(saving);
    setSaveState("Saving…");

    saveInFlightRef.current = (async () => {
      const response = await fetch("/api/content/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saving),
      });
      const result = (await response.json()) as {
        document?: StudioDocument;
        error?: string;
      };
      if (!response.ok || !result.document) {
        throw new Error(result.error || "The draft could not be saved.");
      }

      const saved = result.document;
      const latest = currentRef.current;
      replaceInLibrary(saved, saving.id);

      if (latest && snapshot(latest) === savingSnapshot) {
        if (saved.id === saving.id) {
          lastSavedRef.current = savingSnapshot;
          setSaveState("Saved online");
        } else {
          const renamed = { ...latest, id: saved.id, path: saved.path, slug: saved.slug };
          setCurrent(renamed);
          currentRef.current = renamed;
          lastSavedRef.current = snapshot(renamed);
          setSaveState("Saved online");
        }
      } else if (latest && latest.id === saving.id && saved.id !== saving.id) {
        const renamed = { ...latest, id: saved.id, path: saved.path, slug: saved.slug };
        setCurrent(renamed);
        currentRef.current = renamed;
        saveAgainRef.current = true;
      } else {
        saveAgainRef.current = true;
      }
      return saved;
    })();

    try {
      return await saveInFlightRef.current;
    } catch (error) {
      setSaveState("Could not save");
      showNotice(error instanceof Error ? error.message : "The draft could not be saved.");
      return null;
    } finally {
      saveInFlightRef.current = null;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        void persistCurrentRef.current();
      }
    }
  }, [replaceInLibrary, showNotice]);

  useEffect(() => {
    persistCurrentRef.current = persistCurrent;
  }, [persistCurrent]);

  useEffect(() => {
    if (!current || !current.title.trim()) return;
    if (snapshot(current) === lastSavedRef.current) return;
    setSaveState("Unsaved changes");
    const timer = window.setTimeout(() => void persistCurrent(), 1400);
    return () => window.clearTimeout(timer);
  }, [current, persistCurrent]);

  const updateCurrent = useCallback((patch: Partial<StudioDocument>) => {
    setCurrent((document) => {
      if (!document) return document;
      const next = { ...document, ...patch, isDirty: true };
      currentRef.current = next;
      return next;
    });
  }, []);

  const beginNewPost = async () => {
    await persistCurrent();
    const document = newPost();
    setCurrent(document);
    currentRef.current = document;
    lastSavedRef.current = "";
    setMobileScreen("editor");
    setSaveState("Unsaved changes");
  };

  const beginNewNow = async () => {
    await persistCurrent();
    const document = newPost("now");
    setCurrent(document);
    currentRef.current = document;
    lastSavedRef.current = "";
    setMobileScreen("editor");
    setSaveState("Unsaved changes");
  };

  const chooseDocument = async (document: StudioDocument) => {
    await persistCurrent();
    selectDocument(document);
  };

  const publishSavedDocument = async (document: StudioDocument) => {
    setPublishing(true);
    setSaveState("Saving…");
    try {
      const response = await fetch("/api/content/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: document.id }),
      });
      const result = (await response.json()) as {
        document?: StudioDocument;
        error?: string;
      };
      if (!response.ok || !result.document) {
        throw new Error(result.error || "Publishing did not finish.");
      }
      replaceInLibrary(result.document, document.id);
      setCurrent(result.document);
      currentRef.current = result.document;
      lastSavedRef.current = snapshot(result.document);
      setSaveState("Saved online");
      showNotice(
        result.document.status === "draft"
          ? `Moved to drafts. ${studioConfig.publicationName} is updating.`
          : `Published. ${studioConfig.publicationName} is updating.`,
      );
      if (result.document.status === "published") void waitForLive(result.document);
    } catch (error) {
      setSaveState("Could not save");
      showNotice(error instanceof Error ? error.message : "Publishing did not finish.");
      return false;
    } finally {
      setPublishing(false);
    }
    return true;
  };

  const waitForLive = async (document: StudioDocument) => {
    const pollId = ++livePollRef.current;
    setSaveState("Updating live…");
    for (let attempt = 0; attempt < 18; attempt += 1) {
      if (attempt) await new Promise((resolve) => window.setTimeout(resolve, 5000));
      if (pollId !== livePollRef.current) return;
      try {
        const response = await fetch(`/api/content/live?id=${encodeURIComponent(document.id)}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as { live?: boolean };
        if (response.ok && result.live) {
          setSaveState("Saved online");
          showNotice(`Live now${document.type !== "page" ? ` — ${displayDate(document.date)}` : ""}.`);
          return;
        }
      } catch {
        // Keep checking while the public site rebuilds.
      }
    }
    if (pollId === livePollRef.current) {
      setSaveState("Saved online");
      showNotice("Published to GitHub. The public site is still finishing its update.");
    }
  };

  const publishCurrent = async () => {
    let document = await persistCurrent();
    if (!document) return;
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
    if (!window.confirm(action)) return;
    const previous = document;
    if (isDraft) {
      const next: StudioDocument = {
        ...document,
        status: "published",
        publishedAt: document.publishedAt || new Date().toISOString(),
        isDirty: true,
      };
      setCurrent(next);
      currentRef.current = next;
      replaceInLibrary(next, document.id);
      document = (await persistCurrent()) || next;
    }
    const published = await publishSavedDocument(currentRef.current || document);
    if (published || !isDraft) return;

    const restored: StudioDocument = {
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
    if (!current || current.type === "page" || current.status !== "published") return;
    if (!window.confirm(`Move “${current.title}” to Draft and remove it from the live site?`)) return;

    const previous = current;
    const next: StudioDocument = { ...current, status: "draft", isDirty: true };
    setCurrent(next);
    currentRef.current = next;
    replaceInLibrary(next, current.id);
    const saved = await persistCurrent();
    if (saved && await publishSavedDocument(currentRef.current || saved)) return;

    const restored: StudioDocument = { ...previous, isDirty: true };
    setCurrent(restored);
    currentRef.current = restored;
    replaceInLibrary(restored, previous.id);
    await persistCurrent();
  };

  const deleteCurrent = async () => {
    const document = currentRef.current;
    if (!document || document.type === "page" || document.id.startsWith("new:")) return;
    const confirmed = window.confirm(
      `Delete “${document.title}”? A private recovery copy will be kept.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setSaveState("Deleting…");
    try {
      const response = await fetch("/api/content/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: document.id }),
      });
      const result = (await response.json()) as {
        removedFromGithub?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "The piece could not be deleted.");

      const remaining = documents.filter((item) => item.id !== document.id);
      const next = remaining[0] || null;
      setDocuments(remaining);
      setCurrent(next);
      currentRef.current = next;
      lastSavedRef.current = snapshot(next);
      setSaveState(result.removedFromGithub ? "Updating live…" : "Saved online");
      showNotice(
        result.removedFromGithub
          ? `Deleted “${document.title}”. ${studioConfig.publicationName} is updating.`
          : `Deleted “${document.title}”.`,
      );
    } catch (error) {
      setSaveState("Could not save");
      showNotice(error instanceof Error ? error.message : "The piece could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  const applyItalic = () => {
    if (!current || !bodyRef.current) return;
    bodyRef.current.focus();
    document.execCommand("italic", false);
    updateCurrent({ body: editorToMarkdown(bodyRef.current) });
  };

  const applySectionHeading = () => {
    if (!current || !bodyRef.current) return;
    bodyRef.current.focus();
    document.execCommand("formatBlock", false, "h2");
    updateCurrent({ body: editorToMarkdown(bodyRef.current) });
  };

  const applyBlockQuote = () => {
    const editor = bodyRef.current;
    if (!current || !editor) return;
    editor.focus();
    const selection = window.getSelection();
    const selectedElement = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode as Element
      : selection?.anchorNode?.parentElement;
    const selectedQuote = selectedElement?.closest("blockquote");
    document.execCommand(
      "formatBlock",
      false,
      selectedQuote && editor.contains(selectedQuote) ? "p" : "blockquote",
    );
    updateCurrent({ body: editorToMarkdown(editor) });
  };

  const openExistingLink = (anchor: HTMLAnchorElement) => {
    const editor = bodyRef.current;
    if (!current || !editor?.contains(anchor)) return;

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
    if (!current || !bodyRef.current) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !bodyRef.current.contains(range.commonAncestorContainer)) {
      showNotice("Select some text to link first.");
      return;
    }

    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as Element
      : range.startContainer.parentElement;
    const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer as Element
      : range.endContainer.parentElement;
    const existingLink = startElement?.closest("a");
    if (existingLink && existingLink === endElement?.closest("a")) {
      openExistingLink(existingLink as HTMLAnchorElement);
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
    setLinkOpen(false);
    linkSelectionRef.current = null;
    editingLinkRef.current = null;
    window.requestAnimationFrame(() => bodyRef.current?.focus());
  };

  const saveLink = () => {
    if (!current || !linkLabel.trim() || !isSafeHref(linkHref.trim())) {
      showNotice("Use a complete web address, email link, or site path.");
      return;
    }
    const editor = bodyRef.current;
    const range = linkSelectionRef.current;
    if (!editor || !range) return;

    const existingLink = editingLinkRef.current;
    if (linkMode === "edit" && existingLink && editor.contains(existingLink)) {
      const nextLabel = linkLabel.trim();
      if (existingLink.textContent !== nextLabel) existingLink.textContent = nextLabel;
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
    } else {
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
    if (!editor || !existingLink || !editor.contains(existingLink)) return;

    existingLink.replaceWith(...Array.from(existingLink.childNodes));
    updateCurrent({ body: editorToMarkdown(editor) });
    closeLinkDialog();
  };

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target.closest("a") : null;
    if (!target) return;
    event.preventDefault();
    openExistingLink(target as HTMLAnchorElement);
  };

  const handleEditorInput = () => {
    if (!bodyRef.current) return;
    updateCurrent({ body: editorToMarkdown(bodyRef.current) });
  };

  const handleEditorPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = smartenQuotes(event.clipboardData.getData("text/plain"));
    document.execCommand("insertText", false, text);
    handleEditorInput();
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
      event.preventDefault();
      applyItalic();
      return;
    }
    if (event.key !== "\"" && event.key !== "'") return;

    const editor = bodyRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const before = range.cloneRange();
    before.selectNodeContents(editor);
    before.setEnd(range.startContainer, range.startOffset);
    const previousCharacter = before.toString().slice(-1);
    const opensQuote = !previousCharacter || /[\s([{—]/u.test(previousCharacter);
    const nextCharacter = event.key === "\""
      ? opensQuote ? "“" : "”"
      : opensQuote ? "‘" : "’";

    event.preventDefault();
    range.deleteContents();
    const text = document.createTextNode(nextCharacter);
    range.insertNode(text);
    range.setStartAfter(text);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    handleEditorInput();
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLinkDialog();
      return;
    }
    if (event.key !== "Tab" || !linkDialogRef.current) return;
    const controls = Array.from(
      linkDialogRef.current.querySelectorAll<HTMLElement>("input, button:not(:disabled)"),
    );
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const grouped = useMemo(
    () => ({
      pages: documents.filter((document) => document.type === "page"),
      now: documents.filter((document) => document.type === "now")
        .sort((left, right) =>
          (right.publishedAt || right.date).localeCompare(left.publishedAt || left.date),
        ),
      drafts: documents.filter(
        (document) => document.type === "post" && document.status === "draft",
      ),
      published: documents.filter(
        (document) => document.type === "post" && document.status === "published",
      ).sort((left, right) => right.date.localeCompare(left.date)),
    }),
    [documents],
  );

  const publishLabel = publishing
    ? "Publishing…"
    : !current
      ? "Publish"
      : current.status === "draft"
      ? "Publish"
      : current.isDirty
        ? "Update"
        : "Published";
  const publishDisabled =
    !current?.title.trim() ||
    !current.body.trim() ||
    publishing ||
    (current.status === "published" && !current.isDirty);

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <button
          className="mobile-back"
          type="button"
          onClick={async () => {
            await persistCurrent();
            setMobileScreen("library");
          }}
          aria-label="Back to writing"
        >
          Writing
        </button>
        <div className="studio-title">
          {studioConfig.publicationName} <span>Studio</span>
        </div>
        <div className="editor-header">
          <div className="save-state" aria-live="polite">{saveState}</div>
          <div className="header-actions">
            <a href={studioConfig.siteUrl} target="_blank" rel="noreferrer">View live</a>
            {driveConnected ? (
              <button
                className="sync-button"
                type="button"
                onClick={async () => {
                  if (!current) {
                    await discoverDocuments();
                    return;
                  }
                  const saved = await persistCurrent();
                  const active = currentRef.current || saved;
                  if (active) await syncOne(active.id);
                }}
                disabled={syncing}
                aria-label="Sync with Google Docs"
                title="Sync with Google Docs"
              >
                {syncing ? "…" : "↻"}
              </button>
            ) : null}
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle day and night mode"
              title="Toggle day and night mode"
            >
              <span className="theme-sun" aria-hidden="true">☀︎</span>
              <span className="theme-moon" aria-hidden="true">☾</span>
            </button>
            <button
              className="publish-button"
              type="button"
              disabled={publishDisabled}
              onClick={publishCurrent}
            >
              {publishLabel}
            </button>
          </div>
        </div>
      </header>

      <aside className={`library ${mobileScreen === "library" ? "is-mobile-active" : ""}`}>
        <div className="new-actions">
          <button className="new-button" type="button" onClick={beginNewPost}>
            New piece <span>+</span>
          </button>
          <button className="new-button" type="button" onClick={beginNewNow}>
            New now <span>+</span>
          </button>
        </div>
        <nav aria-label="Writing">
          <LibrarySection title="Pages" documents={grouped.pages} selectedId={current?.id || ""} onSelect={chooseDocument} />
          <LibrarySection title="Now" documents={grouped.now} selectedId={current?.id || ""} onSelect={chooseDocument} />
          <LibrarySection title="Drafts" documents={grouped.drafts} selectedId={current?.id || ""} onSelect={chooseDocument} />
          <LibrarySection title="Published" documents={grouped.published} selectedId={current?.id || ""} onSelect={chooseDocument} />
        </nav>
      </aside>

      <section className={`workspace ${mobileScreen === "editor" ? "is-mobile-active" : ""}`}>
        {current ? (
          <>
            <div className="editor">
              <div className="editor-meta">
                  <button
                    className={`post-state ${current.status === "published" ? "is-published" : ""}`}
                    type="button"
                    disabled
                  >
                  {current.type === "page"
                    ? "Page"
                    : current.type === "now"
                      ? current.status === "published" ? "Now · Published" : "Now · Draft"
                      : current.status === "published" ? "Published" : "Draft"}
                </button>
                {current.type !== "page" ? (
                  <input
                    aria-label="Publication date"
                    type="date"
                    value={current.date}
                    onChange={(event) => updateCurrent({ date: event.target.value })}
                  />
                ) : null}
                  {current.type !== "page" && !current.id.startsWith("new:") ? (
                    <>
                      {current.status === "published" ? (
                        <button
                          className="draft-button"
                          type="button"
                          disabled={publishing || deleting}
                          onClick={moveToDraft}
                        >
                          Move to draft
                        </button>
                      ) : null}
                      <button
                        className="delete-button"
                        type="button"
                        disabled={publishing || deleting}
                        onClick={deleteCurrent}
                      >
                        {deleting ? "Deleting…" : "Delete"}
                      </button>
                    </>
                  ) : null}
              </div>

              <label className="sr-only" htmlFor="title-input">Title</label>
              <textarea
                id="title-input"
                className="title-input"
                rows={2}
                value={current.title}
                placeholder={current.type === "now" ? "Now" : "Untitled"}
                readOnly={current.type === "now"}
                onChange={(event) => updateCurrent({ title: smartenQuotes(event.target.value) })}
              />

              <div className="formatting-toolbar" aria-label="Text formatting">
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={applySectionHeading}
                  aria-label="Section heading"
                  title="Section heading"
                >
                  <Heading2 aria-hidden="true" size={18} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={applyBlockQuote}
                  aria-label="Block quote"
                  title="Block quote"
                >
                  <QuoteIcon aria-hidden="true" size={17} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={applyItalic}
                  aria-label="Italic"
                  title="Italic"
                >
                  <Italic aria-hidden="true" size={17} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={openLink}
                  aria-label="Add link"
                  title="Add link"
                >
                  <LinkIcon aria-hidden="true" size={17} strokeWidth={1.75} />
                </button>
                <span>Select text, then choose a style.</span>
              </div>

              <label className="sr-only" htmlFor="body-input">Main text</label>
              <div
                ref={bodyRef}
                id="body-input"
                className="body-input"
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                tabIndex={0}
                aria-label="Main text"
                aria-multiline="true"
                data-placeholder="Begin anywhere."
                onInput={handleEditorInput}
                onPaste={handleEditorPaste}
                onClick={handleEditorClick}
                onKeyDown={handleEditorKeyDown}
              />

              {current.type === "post" ? (
                <details className="source-details" open={Boolean(current.source)}>
                  <summary>Source or further reading</summary>
                  <div className="source-fields">
                    <label>
                      <span>Link text</span>
                      <input
                        value={current.source?.label || ""}
                        placeholder="Read the original piece"
                        onChange={(event) =>
                          updateCurrent({
                            source: {
                              label: smartenQuotes(event.target.value),
                              href: current.source?.href || "",
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>Web address</span>
                      <input
                        type="url"
                        inputMode="url"
                        value={current.source?.href || ""}
                        placeholder="https://"
                        onChange={(event) =>
                          updateCurrent({
                            source: {
                              label: current.source?.label || "",
                              href: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                </details>
              ) : null}
            </div>

          </>
        ) : (
          <div className="empty-state">
            <p>{saveState === "Loading…" ? "Loading the writing…" : "No writing yet."}</p>
            <button type="button" onClick={beginNewPost}>Start a new piece</button>
          </div>
        )}
      </section>

      {linkOpen ? (
        <div className="dialog-backdrop">
          <button className="dialog-dismiss" type="button" aria-label="Close link dialog" onClick={closeLinkDialog} />
          <section ref={linkDialogRef} className="link-dialog" role="dialog" aria-modal="true" aria-labelledby="link-title">
            <h2 id="link-title">{linkMode === "edit" ? "Edit link" : "Add a link"}</h2>
            <label>
              <span>Text</span>
              <input ref={linkTextRef} value={linkLabel} onChange={(event) => setLinkLabel(smartenQuotes(event.target.value))} onKeyDown={handleDialogKeyDown} />
            </label>
            <label>
              <span>Web address</span>
              <input value={linkHref} onChange={(event) => setLinkHref(event.target.value)} inputMode="url" placeholder="https://" onKeyDown={handleDialogKeyDown} />
            </label>
            <div className="dialog-actions">
              {linkMode === "edit" ? (
                <button className="remove-link-button" type="button" onClick={removeLink} onKeyDown={handleDialogKeyDown}>Remove link</button>
              ) : null}
              <button type="button" onClick={closeLinkDialog} onKeyDown={handleDialogKeyDown}>Cancel</button>
              <button type="button" onClick={saveLink} onKeyDown={handleDialogKeyDown}>{linkMode === "edit" ? "Update link" : "Add link"}</button>
            </div>
          </section>
        </div>
      ) : null}

      <div className={`notice ${notice ? "is-visible" : ""}`} role="status" aria-live="polite">
        {notice}
      </div>
    </main>
  );
}
