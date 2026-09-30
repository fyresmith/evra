// The engine and sync code don't touch Obsidian; this keeps the bundler happy if anything imports it.
export const sanitizeHTMLToDom = (): never => { throw new Error('not in tests'); };
