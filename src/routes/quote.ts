import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getRates } from "../carriers/get-rates.js";
import type { NuvemshopQuoteOption, NuvemshopQuoteRequest } from "../types.js";

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
    const originCep = body.origin.postal_code.replace(/\D/g, "").padStart(8, "0");

    const rates = await getRates({ originCep, destinationCep, totalGrams, cartValueCents });

    const options: NuvemshopQuoteOption[] = rates.map((r) => ({
      name: r.carrierName,
      code: r.carrierCode,
      price: r.priceCents / 100,
      // quanto custaria sem o frete grátis — a Nuvemshop usa isso pra saber o custo real da loja
      ...(r.originalPriceCents !== undefined ? { price_merchant: r.originalPriceCents / 100 } : {}),
      currency: body.currency,
      type: "ship",
      min_delivery_date: toIsoDeadline(r.deadlineDays),
      max_delivery_date: toIsoDeadline(r.deadlineDays + 1),
    }));

    return reply.send({ rates: options });
  });
}
