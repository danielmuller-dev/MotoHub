import { describe, expect, it } from "vitest";
import { assertImageFile, dataUrlToFile } from "../src/services/storage";

describe("inspection upload validation", () => {
  it("aceita imagens jpg, png e webp", () => {
    expect(() => assertImageFile(new File(["foto"], "vistoria.jpg", { type: "image/jpeg" }))).not.toThrow();
    expect(() => assertImageFile(new File(["foto"], "vistoria.png", { type: "image/png" }))).not.toThrow();
    expect(() => assertImageFile(new File(["foto"], "vistoria.webp", { type: "image/webp" }))).not.toThrow();
  });

  it("bloqueia tipo de arquivo invalido", () => {
    expect(() => assertImageFile(new File(["pdf"], "vistoria.pdf", { type: "application/pdf" }))).toThrow("Formato");
  });

  it("bloqueia imagem maior que 8 MB", () => {
    const largeFile = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "grande.png", {
      type: "image/png"
    });

    expect(() => assertImageFile(largeFile)).toThrow("8 MB");
  });

  it("converte assinatura em data URL para arquivo", () => {
    const payload = Buffer.from("assinatura").toString("base64");
    const file = dataUrlToFile(`data:image/png;base64,${payload}`, "assinatura.png");

    expect(file.name).toBe("assinatura.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBeGreaterThan(0);
  });
});
