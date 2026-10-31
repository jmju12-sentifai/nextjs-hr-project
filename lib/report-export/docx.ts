import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Footer,
  PageNumber,
  AlignmentType,
} from "docx";
import type { ExportDocument } from "./model";
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const border = { style: BorderStyle.SINGLE, size: 3, color: "E4EBF5" };
const run = (text: string, bold = false, color = "071A3B", size = 19) =>
  new TextRun({
    text,
    bold,
    color,
    size,
    font: {
      ascii: "Noto Sans KR",
      eastAsia: "Noto Sans KR",
      hAnsi: "Noto Sans KR",
      cs: "Noto Sans KR",
    },
  });
const paragraph = (text: string, bold = false, size = 19) =>
  new Paragraph({
    children: [run(text, bold, undefined, size)],
    spacing: { after: 65, line: 220 },
    keepNext: false,
  });
export async function renderDocumentWord(
  model: ExportDocument,
  legacy?: (el: any) => any[],
) {
  const accent = model.accent.slice(1);
  const sections = model.pages.map((blocks, page) => {
    const children: any[] = [
      new Paragraph({
        children: [run(model.title, true, undefined, page === 0 ? 32 : 24)],
        heading: "Title",
        spacing: { after: 120 },
      }),
      paragraph(
        [model.pathLabel, model.issuer.company].filter(Boolean).join(" · "),
        false,
        17,
      ),
    ];
    if (page === 0)
      children.push(
        paragraph(
          [
            ...model.subjects.map((r) => `${r.label} ${r.value}`),
            `발행일 ${model.issuedAt}`,
          ].join(" · "),
          false,
          16,
        ),
      );
    for (const b of blocks) {
      if (b.title)
        children.push(
          new Paragraph({
            children: [run(b.title, true, undefined, 21)],
            spacing: { before: 100, after: 65 },
            keepNext: true,
          }),
        );
      if (b.text)
        children.push(
          new Paragraph({
            children: [
              run(
                b.text,
                b.type === "headline",
                b.type === "headline" ? accent : undefined,
                b.type === "headline" ? 24 : 19,
              ),
            ],
            spacing: { after: 90, line: 250 },
            keepNext: b.type === "formula",
          }),
        );
      if (b.type === "formula" && b.secondary)
        children.push(paragraph(b.secondary, true, 21));
      if (b.type === "element" && legacy) children.push(...legacy(b.element));
      if (b.rows.length) {
        children.push(
          new Table({
            borders: {
              top: none,
              bottom: none,
              left: none,
              right: none,
              insideHorizontal: none,
              insideVertical: none,
            },
            width: { size: 9300, type: WidthType.DXA },
            columnWidths: [6600, 2700],
            rows: b.rows.map(
              (r) =>
                new TableRow({
                  cantSplit: true,
                  children: [
                    new TableCell({
                      width: { size: 6600, type: WidthType.DXA },
                      borders: { bottom: border },
                      margins: { top: 40, bottom: 40, left: 95, right: 95 },
                      shading: r.strong ? { fill: "F2F6FC" } : undefined,
                      children: [
                        new Paragraph({
                          children: [
                            run(r.label + (r.muted ? " · 제외" : ""), r.strong),
                          ],
                          spacing: { after: 0, line: 220 },
                        }),
                        ...(r.note && !r.muted
                          ? [paragraph(r.note, false, 15)]
                          : []),
                      ],
                    }),
                    new TableCell({
                      width: { size: 2700, type: WidthType.DXA },
                      borders: { bottom: border },
                      margins: { top: 40, bottom: 40, left: 95, right: 95 },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [
                            run(
                              r.value,
                              r.strong,
                              r.muted ? "718099" : undefined,
                            ),
                          ],
                          spacing: { after: 0, line: 220 },
                        }),
                      ],
                    }),
                  ],
                }),
            ),
          }),
        );
        children.push(new Paragraph({ spacing: { after: 20, line: 80 }, children: [] }));
      }
      if (b.secondary && b.type !== "formula")
        children.push(paragraph(b.secondary, false, 16));
    }
    return {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 600, bottom: 650, left: 1200, right: 1200 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                run(
                  [
                    model.issuer.company,
                    model.issuer.dept,
                    model.issuer.contact && `문의 ${model.issuer.contact}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  false,
                  "718099",
                  14,
                ),
                new TextRun({ text: "    ", size: 14 }),
                new TextRun({
                  children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
                  size: 14,
                }),
              ],
              spacing: { before: 50 },
            }),
          ],
        }),
      },
      children,
    };
  });
  return Packer.toBuffer(
    new Document({
      title: model.title,
      creator: model.issuer.company || "HRcoach",
      styles: {
        default: {
          document: {
            run: {
              font: {
                ascii: "Noto Sans KR",
                eastAsia: "Noto Sans KR",
                hAnsi: "Noto Sans KR",
                cs: "Noto Sans KR",
              },
              size: 19,
            },
          },
        },
      },
      sections,
    }),
  );
}
