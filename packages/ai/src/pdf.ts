import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** Plain text of each page of a PDF, used to check that every quote the AI gives really is in the document. */
export async function pdfPages(bytes: Uint8Array): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
        .join(""),
    );
  }
  await doc.destroy();
  return pages;
}
