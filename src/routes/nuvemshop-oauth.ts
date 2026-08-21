import type { FastifyInstance } from "fastify";
import { createShippingCarrier, createShippingCarrierOptions, exchangeCodeForToken } from "../nuvemshop/oauth.js";
import { saveNuvemshopInstall } from "../nuvemshop/store.js";
import { listActiveCarriers } from "../db/carriers.js";

function page(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, "Segoe UI", system-ui, sans-serif; background: #F3F4F0; color: #1B211D; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border: 1px solid #D6D9CD; border-radius: 12px; padding: 32px; max-width: 480px; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    p { font-size: 14px; line-height: 1.6; color: #57614F; }
    code { background: #E9EBE3; padding: 2px 6px; border-radius: 5px; font-size: 13px; }
    .ok { color: #2F7D4F; } .bad { color: #B23B3B; }
  </style>
</head>
<body><div class="card">${bodyHtml}</div></body>
</html>`;
}

export default async function nuvemshopOAuthRoutes(app: FastifyInstance) {
  app.get("/nuvemshop/callback", async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      return reply.code(400).type("text/html").send(page("Erro", "<h1 class='bad'>Faltando o parâmetro 'code'.</h1>"));
    }

    let storeId: string;
    let accessToken: string;
    try {
      const tokenResult = await exchangeCodeForToken(code);
      storeId = tokenResult.storeId;
      accessToken = tokenResult.accessToken;
      await saveNuvemshopInstall(storeId, accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      request.log.error({ err }, "Falha na troca do código OAuth da Nuvemshop");
      return reply.code(500).type("text/html").send(page("Erro na instalação", `<h1 class="bad">Falha ao instalar</h1><p>${message}</p>`));
    }

    const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `${request.protocol}://${request.hostname}`;
    const callbackUrl = `${publicBaseUrl}/quote`;

    try {
      const carrier = await createShippingCarrier(storeId, accessToken, callbackUrl);
      const carriers = await listActiveCarriers();
      await createShippingCarrierOptions(
        storeId,
        accessToken,
        carrier.id,
        carriers.map((c) => ({ code: c.code, name: c.name })),
      );
      return reply.type("text/html").send(
        page(
          "Instalado!",
          `<h1 class="ok">App instalado e transportadora cadastrada ✓</h1>
           <p>Loja: <code>${storeId}</code></p>
           <p>Transportadora: <strong>${carrier.name}</strong> (id ${carrier.id})</p>
           <p>Callback: <code>${carrier.callback_url}</code></p>
           <p>Opções cadastradas: <code>${carriers.map((c) => c.code).join(", ")}</code></p>
           <p>Já pode fechar essa aba e testar uma cotação no checkout.</p>`,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      request.log.error({ err }, "Falha ao cadastrar shipping_carrier na Nuvemshop");
      return reply.type("text/html").send(
        page(
          "Instalado, mas...",
          `<h1 class="ok">App instalado</h1>
           <p>Loja: <code>${storeId}</code></p>
           <h1 class="bad" style="margin-top:20px">Falha ao cadastrar a transportadora</h1>
           <p>${message}</p>`,
        ),
      );
    }
  });
}
