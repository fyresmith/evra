// Browser stand-in for the "obsidian" module, for the visual harness only. Obsidian's own enhance.js supplies the DOM helpers.
export const sanitizeHTMLToDom = (html: string): DocumentFragment => document.createRange().createContextualFragment(html);
