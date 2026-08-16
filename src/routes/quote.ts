import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listActiveCarriers } from "../db/carriers.js";
import { listActiveRules } from "../db/rules.js";
import { getCorreiosQuote } from "../carriers/correios/client.js";
import { getFlatTableQuote, getZoneTableQuote } from "../carriers/table/lookup.js";
import { cepToUf } from "../carriers/cep.js";
import { applyRules } from "../rules/engine.js";
import type { BaseQuote, NuvemshopQuoteOption, NuvemshopQuoteRequest } from "../types.js";

const requestSchema = z.object({
  cart: z.object({ currency: z.string(), subtotal: z.number() }),
  origin: z.object({ zipcode: z.string() }),
  destination: z.object({ zipcode: z.string() }),
  items: z.array(z.object({ quantity: z.number(), grams: z.number() })),
});

export default async function quoteRoutes(app: FastifyInstance) {
  app.post("/quote", async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Payload de cotação inválido.", details: parsed.error.flatten() });
    }
    const body = parsed.data as NuvemshopQuoteRequest;

    const totalGrams = body.items.reduce((sum, item) => sum + item.grams * item.quantity, 0);
    const cartValueCents = Math.round(body.cart.subtotal * 100);
    const destinationUf = cepToUf(body.destination.zipcode);

    const [carriers, rules] = await Promise.all([listActiveCarriers(), listActiveRules()]);

    const options: NuvemshopQuoteOption[] = [];

    for (const carrier of carriers) {
      let base: BaseQuote | null = null;

      try {
        if (carrier.priceSource === "api") {
          const result = await getCorreiosQuote({
            cepOrigem: body.origin.zipcode,
            cepDestino: body.destination.zipcode,
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
              ? await getZoneTableQuote(carrier.id, body.destination.zipcode, totalGrams)
              : await getFlatTableQuote(carrier.id, body.destination.zipcode, totalGrams);
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
      });

      options.push({
        name: adjusted.carrierName,
        code: adjusted.carrierCode,
        price: adjusted.priceCents / 100,
        currency: body.cart.currency,
        min_delivery_date: adjusted.deadlineDays,
        max_delivery_date: adjusted.deadlineDays + 1,
      });
    }

    options.sort((a, b) => a.price - b.price);
    return options;
  });
}
