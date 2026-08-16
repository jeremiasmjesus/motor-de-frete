import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listActiveCarriers } from "../db/carriers.js";
import { listActiveRules } from "../db/rules.js";
import { getCorreiosQuote } from "../carriers/correios/client.js";
import { getFlatTableQuote, getZoneTableQuote } from "../carriers/table/lookup.js";
import { cepToUf } from "../carriers/cep.js";
import { applyRules } from "../rules/engine.js";
import type { BaseQuote, NuvemshopQuoteOption, NuvemshopQuoteRequest } from "../types.js";

// Contrato real da Nuvemshop: https://tiendanube.github.io/api-documentation/resources/shipping-carrier
const requestSchema = z.object({
  cart_id: z.string(),
  store_id: z.number(),
  currency: z.string(),
  total_price: z.number(),
  origin: z.object({ postal_code: z.string() }),
  destination: z.object({ postal_code: z.string() }),
  items: z.array(z.object({ id: z.number(), quantity: z.number(), grams: z.number(), price: z.number() })),
});

function toIsoDeadline(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

export default async function quoteRoutes(app: FastifyInstance) {
  app.post("/quote", async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Payload de cotação inválido.", details: parsed.error.flatten() });
    }
    const body = parsed.data as NuvemshopQuoteRequest;

    const totalGrams = body.items.reduce((sum, item) => sum + item.grams * item.quantity, 0);
    // total_price já é o valor final do carrinho (com desconto aplicado) — não o subtotal bruto.
    const cartValueCents = Math.round(body.total_price * 100);
    const destinationCep = body.destination.postal_code.replace(/\D/g, "").padStart(8, "0");
    const destinationUf = cepToUf(destinationCep);

    const [carriers, rules] = await Promise.all([listActiveCarriers(), listActiveRules()]);

    const options: NuvemshopQuoteOption[] = [];

    for (const carrier of carriers) {
      let base: BaseQuote | null = null;

      try {
        if (carrier.priceSource === "api") {
          const result = await getCorreiosQuote({
            cepOrigem: body.origin.postal_code.replace(/\D/g, "").padStart(8, "0"),
            cepDestino: destinationCep,
            pesoGramas: totalGrams,
          });
          base = {
            carrierCode: carrier.code,
            carrierName: carrier.name,
            priceCents: result.precoCentavos,
            deadlineDays: 3, // TODO: complementar com a API Prazo dos Correios
          };
        } else {
          const result =
            carrier.pricingModel === "zone"
              ? await getZoneTableQuote(carrier.id, destinationCep, totalGrams)
              : await getFlatTableQuote(carrier.id, destinationCep, totalGrams);
          if (result) {
            base = {
              carrierCode: carrier.code,
              carrierName: carrier.name,
              priceCents: result.precoCentavos,
              deadlineDays: result.prazoDias,
            };
          }
        }
      } catch (err) {
        request.log.error({ err, carrier: carrier.code }, "Falha ao cotar transportadora");
        continue; // não derruba a cotação inteira por causa de uma transportadora fora do ar
      }

      if (!base) continue;

      const adjusted = applyRules(base, rules, {
        cartValueCents,
        destinationUf: destinationUf ?? "",
        destinationCep,
      });

      options.push({
        name: adjusted.carrierName,
        code: adjusted.carrierCode,
        price: adjusted.priceCents / 100,
        currency: body.currency,
        type: "ship",
        min_delivery_date: toIsoDeadline(adjusted.deadlineDays),
        max_delivery_date: toIsoDeadline(adjusted.deadlineDays + 1),
      });
    }

    options.sort((a, b) => a.price - b.price);
    return reply.send({ rates: options });
  });
}
