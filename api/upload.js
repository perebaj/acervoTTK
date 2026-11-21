import { handleUpload } from "@vercel/blob/client";
import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES } from "../lib/shared.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!String(pathname).startsWith("media/")) {
          throw new Error("Caminho de upload inválido.");
        }
        if (clientPayload) {
          const parsed = JSON.parse(clientPayload);
          if (parsed && parsed.website) {
            throw new Error("Upload bloqueado.");
          }
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });

    return res.status(200).json(jsonResponse);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Falha ao autorizar upload." });
  }
}
