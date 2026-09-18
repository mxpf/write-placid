"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { captionDomToMarkdown, captionToHtml, escapeCaptionText, safeCaptionHref } from "./caption-inline.ts";

type Props = { value: string; onChange: (value: string) => void; disabled?: boolean };

/** An isolated inline editor: its DOM is never replaced while the author types. */
export function CaptionEditor({ value, onChange, disabled = false }: Props) {
  const initialValue = useRef(value);
  const editorRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (editorRef.current) editorRef.current.innerHTML = captionToHtml(initialValue.current); }, []);
  const selectionRef = useRef<Range | null>(null);
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [editingLink, setEditingLink] = useState(false);
  const [message, setMessage] = useState("");
  const hrefRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (linkOpen) hrefRef.current?.focus({ preventScroll: true }); }, [linkOpen]);
  const [italic, setItalic] = useState(false);
  const sync = () => {
    if (editorRef.current) onChange(captionDomToMarkdown(editorRef.current));
  };
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
      setItalic(document.queryCommandState("italic"));
    }
  };
  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return false;
    editor.focus({ preventScroll: true });
    const range = selectionRef.current;
    if (!range || !editor.contains(range.commonAncestorContainer)) return false;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  };
  const toggleItalic = () => {
    rememberSelection();
    if (disabled || !restoreSelection()) return;
    document.execCommand("italic");
    rememberSelection();
    sync();
  };
  const openLink = (anchor?: HTMLAnchorElement) => {
    if (disabled) return;
    rememberSelection();
    const range = selectionRef.current;
    const element = range?.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer as Element : range?.commonAncestorContainer.parentElement;
    const existing = anchor || element?.closest<HTMLAnchorElement>("a");
    if (existing && editorRef.current?.contains(existing)) {
      const linkRange = document.createRange();
      linkRange.selectNodeContents(existing);
      selectionRef.current = linkRange;
      linkRef.current = existing;
      setHref(existing.getAttribute("href") || "");
      setEditingLink(true);
    } else {
      if (!range || range.collapsed) { setMessage("Select caption text to add a link."); return; }
      linkRef.current = null;
      setHref("");
      setEditingLink(false);
    }
    setMessage("");
    setLinkOpen(true);
  };
  const cancelLink = () => {
    setLinkOpen(false);
    setMessage("");
    restoreSelection();
  };
  const applyLink = () => {
    const safeHref = safeCaptionHref(href.trim());
    if (!safeHref) { setMessage("Enter an https, http, or email link, a /path, or a #section."); return; }
    if (!restoreSelection()) return;
    const existing = linkRef.current;
    if (existing && editorRef.current?.contains(existing)) existing.setAttribute("href", safeHref);
    else document.execCommand("createLink", false, safeHref);
    sync();
    rememberSelection();
    setLinkOpen(false);
    setMessage("");
  };
  const removeLink = () => {
    if (!restoreSelection()) return;
    const existing = linkRef.current;
    if (existing && editorRef.current?.contains(existing)) {
      const children = Array.from(existing.childNodes);
      existing.replaceWith(...children);
      if (children.length) {
        const range = document.createRange();
        range.setStartBefore(children[0]);
        range.setEndAfter(children[children.length - 1]);
        selectionRef.current = range;
        restoreSelection();
      }
    }
    sync();
    rememberSelection();
    setLinkOpen(false);
    setMessage("");
  };
  return <div className="caption-composer">
    <span id="caption-label">Caption (optional)</span>
    <div className="caption-toolbar" role="group" aria-label="Caption formatting">
      <button type="button" aria-label="Italic caption text" aria-pressed={italic} disabled={disabled || linkOpen} onMouseDown={event => event.preventDefault()} onClick={toggleItalic}><i>Italic</i></button>
      <button type="button" aria-label="Link caption text" disabled={disabled || linkOpen} onMouseDown={event => event.preventDefault()} onClick={() => openLink()}>Link</button>
    </div>
    <div ref={editorRef} className="caption-input" role="textbox" aria-labelledby="caption-label" aria-describedby="image-caption-help" aria-multiline="false" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning tabIndex={0}
      onInput={sync} onMouseUp={rememberSelection} onKeyUp={rememberSelection} onBlur={rememberSelection}
      onClick={event => {
        const anchor = (event.target as Element).closest<HTMLAnchorElement>("a");
        if (anchor) { event.preventDefault(); openLink(anchor); }
      }}
      onKeyDown={event => {
        if ((event.metaKey || event.ctrlKey) && ["i", "k", "b", "u"].includes(event.key.toLowerCase())) {
          event.preventDefault(); event.stopPropagation();
          if (event.key.toLowerCase() === "i") { rememberSelection(); toggleItalic(); }
          if (event.key.toLowerCase() === "k") openLink();
        }
        if (event.key === "Enter") event.preventDefault();
        if (event.key === "Escape" && linkOpen) { event.preventDefault(); event.stopPropagation(); cancelLink(); }
      }}
      onPaste={event => {
        event.preventDefault();
        const html = event.clipboardData.getData("text/html");
        const markdown = html
          ? captionDomToMarkdown(new DOMParser().parseFromString(html, "text/html").body)
          : escapeCaptionText(event.clipboardData.getData("text/plain"));
        document.execCommand("insertHTML", false, captionToHtml(markdown));
        rememberSelection(); sync();
      }}
      onDrop={event => event.preventDefault()}
    />
    <p id="image-caption-help">Appears beneath the image. Select text to add italics or a link.</p>
    {/* Keyboard events are delegated from the inline link controls. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
    {linkOpen ? <div className="caption-link-controls" role="group" aria-label="Caption link" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelLink(); }
      if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") { event.preventDefault(); event.stopPropagation(); applyLink(); }
    }}>
      <label><span>Caption link address</span><input ref={hrefRef} value={href} onChange={event => setHref(event.target.value)} placeholder="https://" /></label>
      <div className="caption-link-actions">
        {editingLink ? <button type="button" onClick={removeLink}>Remove link</button> : null}
        <button type="button" onClick={cancelLink}>Cancel link</button>
        <button type="button" onClick={applyLink}>Apply link</button>
      </div>
    </div> : null}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
