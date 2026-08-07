import { put } from "@vercel/blob";

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSizeBytes = 8 * 1024 * 1024;

export type StoredFile = {
  url: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
};

export function assertImageFile(file: File) {
  if (!allowedImageTypes.includes(file.type)) {
    throw new Error("Formato de imagem invalido. Use JPG, PNG ou WebP.");
  }

  if (file.size > maxImageSizeBytes) {
    throw new Error("Imagem muito grande. Envie arquivos de ate 8 MB.");
  }
}

export async function uploadInspectionImage(input: {
  companyId: string;
  inspectionId: string;
  file: File;
  folder: "photos" | "signatures";
  nameHint: string;
}) {
  assertImageFile(input.file);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Configure BLOB_READ_WRITE_TOKEN para enviar fotos de vistoria.");
  }

  const extension = input.file.type === "image/png"
    ? "png"
    : input.file.type === "image/webp"
      ? "webp"
      : "jpg";
  const safeName = input.nameHint.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
  const storageKey = `inspections/${input.companyId}/${input.inspectionId}/${input.folder}/${safeName}.${extension}`;
  const blob = await put(storageKey, input.file, {
    access: "public",
    addRandomSuffix: true
  });

  return {
    url: blob.url,
    storageKey: blob.pathname,
    contentType: input.file.type,
    sizeBytes: input.file.size
  } satisfies StoredFile;
}

export function dataUrlToFile(dataUrl: string, fileName: string) {
  const [metadata, payload] = dataUrl.split(",");
  const match = metadata?.match(/^data:(image\/(?:png|jpeg|webp));base64$/);

  if (!match || !payload) {
    throw new Error("Assinatura invalida.");
  }

  const contentType = match[1];
  const buffer = Buffer.from(payload, "base64");
  return new File([buffer], fileName, { type: contentType });
}
