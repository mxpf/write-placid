/**
 * Write Placid Studio's private Google Docs bridge.
 *
 * Script properties required:
 *   BRIDGE_SECRET — a long random value shared only with the Studio server
 *   FOLDER_ID     — the writing drafts folder ID
 */

function doGet() {
  return json_({ ok: true, service: "Write Placid Studio" });
}

function doPost(event) {
  try {
    const input = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty("BRIDGE_SECRET");
    if (!expectedSecret || input.secret !== expectedSecret) {
      return json_({ ok: false, error: "Not authorized." });
    }

    let result;
    if (input.action === "list") result = listDocuments_();
    else if (input.action === "get") result = readDocument_(input.documentId);
    else if (input.action === "put") result = writeDocument_(input);
    else if (input.action === "create") result = createDocument_(input);
    else throw new Error("Unknown action.");
    return json_({ ok: true, result: result });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function folder_() {
  const folderId = PropertiesService.getScriptProperties().getProperty("FOLDER_ID");
  if (!folderId) throw new Error("FOLDER_ID has not been configured.");
  return DriveApp.getFolderById(folderId);
}

function listDocuments_() {
  const files = folder_().getFilesByType(MimeType.GOOGLE_DOCS);
  const result = [];
  while (files.hasNext()) {
    const file = files.next();
    result.push({
      id: file.getId(),
      title: file.getName(),
      revision: String(file.getLastUpdated().getTime()),
    });
  }
  return result.sort(function (left, right) {
    return left.title.localeCompare(right.title);
  });
}

function readDocument_(documentId) {
  if (!documentId) throw new Error("A document ID is required.");
  const file = DriveApp.getFileById(documentId);
  const document = DocumentApp.openById(documentId);
  return {
    id: documentId,
    title: file.getName(),
    body: bodyToMarkdown_(document.getBody()),
    revision: String(file.getLastUpdated().getTime()),
  };
}

function createDocument_(input) {
  const title = String(input.title || "Untitled").trim() || "Untitled";
  const document = DocumentApp.create(title);
  DriveApp.getFileById(document.getId()).moveTo(folder_());
  replaceBody_(document, String(input.body || ""));
  document.saveAndClose();
  Utilities.sleep(150);
  return readDocument_(document.getId());
}

function writeDocument_(input) {
  const current = readDocument_(input.documentId);
  if (input.expectedRevision && String(input.expectedRevision) !== current.revision) {
    throw new Error("The Google Doc changed while Studio was saving. Sync again before choosing a version.");
  }
  const document = DocumentApp.openById(input.documentId);
  replaceBody_(document, String(input.body || ""));
  document.saveAndClose();
  if (input.title) DriveApp.getFileById(input.documentId).setName(String(input.title));
  Utilities.sleep(150);
  return readDocument_(input.documentId);
}

function replaceBody_(document, markdown) {
  const body = document.getBody();
  body.clear();
  const paragraphs = String(markdown || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\s*\n/);
  if (!paragraphs.length || (paragraphs.length === 1 && !paragraphs[0])) return;
  paragraphs.forEach(function (source, index) {
    const parsed = parseInlineMarkdown_(source.replace(/\n/g, " "));
    const paragraph = index === 0 ? body.getParagraphs()[0] : body.appendParagraph("");
    const text = paragraph.editAsText();
    text.setText(parsed.text);
    parsed.styles.forEach(function (style) {
      if (style.end < style.start) return;
      if (style.italic) text.setItalic(style.start, style.end, true);
      if (style.link) text.setLinkUrl(style.start, style.end, style.link);
    });
  });
}

function parseInlineMarkdown_(source) {
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let text = "";
  let cursor = 0;
  const styles = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    text += source.slice(cursor, match.index);
    const value = match[1] || match[3] || match[4] || match[0];
    const start = text.length;
    text += value;
    styles.push({
      start: start,
      end: text.length - 1,
      italic: Boolean(match[3] || match[4]),
      link: match[2] || "",
    });
    cursor = match.index + match[0].length;
  }
  text += source.slice(cursor);
  return { text: text, styles: styles };
}

function bodyToMarkdown_(body) {
  const paragraphs = [];
  for (let index = 0; index < body.getNumChildren(); index += 1) {
    const child = body.getChild(index);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH &&
        child.getType() !== DocumentApp.ElementType.LIST_ITEM) continue;
    paragraphs.push(textToMarkdown_(child.asText()));
  }
  return paragraphs.join("\n\n").trim();
}

function textToMarkdown_(textElement) {
  const text = textElement.getText();
  if (!text) return "";
  let result = "";
  let start = 0;
  while (start < text.length) {
    const italic = textElement.isItalic(start) === true;
    const link = textElement.getLinkUrl(start) || "";
    let end = start + 1;
    while (
      end < text.length &&
      (textElement.isItalic(end) === true) === italic &&
      (textElement.getLinkUrl(end) || "") === link
    ) end += 1;
    let value = text.slice(start, end);
    if (italic) value = "*" + value + "*";
    if (link) value = "[" + value + "](" + link + ")";
    result += value;
    start = end;
  }
  return result;
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
