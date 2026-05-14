import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

type ArtifactDocxInput = {
  id: string;
  product_id: string;
  title: string;
  type?: string;
  stage_name?: string;
  stage_id?: string;
  framework_key?: string;
  status?: string;
  version?: string;
  content?: string;
  description?: string;
  created_by_email?: string;
  updated_by_email?: string;
  created_at?: any;
  updated_at?: any;
};

type ProductDocxInput = {
  id?: string;
  name?: string;
  status?: string;
  current_stage?: string;
};

function safeText(value: any): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (value?.toDate && typeof value.toDate === "function") {
    return value.toDate().toLocaleString("pt-BR");
  }

  if (value instanceof Date) {
    return value.toLocaleString("pt-BR");
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function slugifyFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80);
}

function parseContentToParagraphs(content: string): Paragraph[] {
  if (!content || !content.trim()) {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "Este artefato ainda não possui conteúdo.",
            italics: true,
          }),
        ],
      }),
    ];
  }

  const lines = content.split("\n");

  return lines.map((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return new Paragraph({ text: "" });
    }

    if (trimmed.startsWith("# ")) {
      return new Paragraph({
        text: trimmed.replace(/^# /, ""),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      });
    }

    if (trimmed.startsWith("## ")) {
      return new Paragraph({
        text: trimmed.replace(/^## /, ""),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 220, after: 100 },
      });
    }

    if (trimmed.startsWith("### ")) {
      return new Paragraph({
        text: trimmed.replace(/^### /, ""),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 180, after: 80 },
      });
    }

    if (trimmed.startsWith("- ")) {
      return new Paragraph({
        children: [
          new TextRun({
            text: trimmed.replace(/^- /, ""),
          }),
        ],
        bullet: {
          level: 0,
        },
        spacing: { after: 80 },
      });
    }

    if (/^\d+\.\s/.test(trimmed)) {
      return new Paragraph({
        text: trimmed,
        spacing: { after: 80 },
      });
    }

    // Handle inline bold markers **
    const parts = trimmed.split(/(\*\*.*?\*\*)/);
    const children = parts.map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return new TextRun({
          text: part.slice(2, -2),
          bold: true,
        });
      }
      return new TextRun({
        text: part,
      });
    });

    return new Paragraph({
      children,
      spacing: { after: 120 },
    });
  });
}

function createMetadataTable(artifact: ArtifactDocxInput, product?: ProductDocxInput): Table {
  const rows = [
    ["Produto", product?.name || "Não informado"],
    ["Artefato", artifact.title || "Sem título"],
    ["Tipo", artifact.type || "Não informado"],
    ["Etapa", artifact.stage_name || artifact.stage_id || "Não informada"],
    ["Framework", artifact.framework_key || "Não informado"],
    ["Versão", artifact.version || "v0.1"],
    ["Status", artifact.status || "draft"],
    ["Criado por", artifact.created_by_email || "Não informado"],
    ["Atualizado por", artifact.updated_by_email || "Não informado"],
    ["Criado em", safeText(artifact.created_at)],
    ["Atualizado em", safeText(artifact.updated_at)],
  ];

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows: rows.map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: label,
                    bold: true,
                  }),
                ],
              }),
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
            },
          }),
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: value || "Não informado",
                  }),
                ],
              }),
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
            },
          }),
        ],
      })
    ),
  });
}

export async function exportArtifactToDocx(
  artifact: ArtifactDocxInput,
  product?: ProductDocxInput,
  user?: { uid: string; email: string }
): Promise<void> {
  if (!artifact?.title) {
    throw new Error("Artefato sem título. Não foi possível exportar para DOCX.");
  }

  const generatedAt = new Date();

  const doc = new Document({
    creator: "Product Constructor",
    title: artifact.title,
    description: artifact.description || "",
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: artifact.title,
                bold: true,
                size: 36,
              }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${artifact.stage_name || "Etapa não informada"} · ${artifact.version || "v0.1"} · ${artifact.status || "draft"}`,
                italics: true,
                size: 22,
              }),
            ],
            spacing: { after: 360 },
          }),

          new Paragraph({
            text: "Metadados",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          }),

          createMetadataTable(artifact, product),

          new Paragraph({
            text: "",
            spacing: { after: 240 },
          }),

          new Paragraph({
            text: "Conteúdo",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 160 },
          }),

          ...parseContentToParagraphs(artifact.content || ""),

          new Paragraph({
            text: "",
            spacing: { before: 400 },
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Exportado pelo Product Constructor em ${generatedAt.toLocaleString("pt-BR")}`,
                italics: true,
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  const productName = slugifyFilename(product?.name || "produto");
  const artifactName = slugifyFilename(artifact.title || "artefato");
  const version = slugifyFilename(artifact.version || "v0-1");

  saveAs(blob, `${productName}-${artifactName}-${version}.docx`);

  // Log history
  if (user) {
    try {
      await addDoc(collection(db, 'product_history'), {
        product_id: artifact.product_id,
        type: "artifact_exported_docx",
        title: `Artefato exportado para DOCX: ${artifact.title}`,
        description: `${artifact.title} (${artifact.version}) foi exportado como DOCX.`,
        artifact_id: artifact.id,
        stage_id: artifact.stage_id,
        created_by: user.uid,
        created_by_email: user.email,
        created_at: serverTimestamp()
      });
    } catch (err) {
      console.warn("Failed to log export history:", err);
    }
  }
}
