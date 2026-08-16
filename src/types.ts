export type UserRole = "admin" | "operador";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export type PriceSource = "api" | "table";
export type PricingModel = "flat" | "zone";

export interface Carrier {
  id: string;
  name: string;
  code: string;
  priceSource: PriceSource;
  pricingModel: PricingModel;
  active: boolean;
}

export interface BaseQuote {
  carrierCode: string;
  carrierName: string;
  priceCents: number;
  deadlineDays: number;
  /** Preenchido só quando o frete grátis zerou o preço — quanto o cliente pagaria sem a regra. */
  originalPriceCents?: number;
}

export type RuleType =
  | "valor_fixo"
  | "valor_fixo_adicional"
  | "percentual"
  | "percentual_valor_declarado"
  | "frete_gratis"
  | "acrescimo_prazo";

export type GeoFilterMode = "regiao" | "estado" | "cep";

export interface RuleCondition {
  /** Valor final do carrinho, já com desconto — não o subtotal bruto dos itens. */
  cartValueMinCents?: number;
  geoMode?: GeoFilterMode;
  regioes?: string[]; // usado quando geoMode === 'regiao', ex: ['Sudeste', 'Sul']
  ufs?: string[]; // usado quando geoMode === 'estado', ex: ['SP', 'RJ']
  cepFrom?: string; // usado quando geoMode === 'cep'
  cepTo?: string;
}

export interface RuleAction {
  fixedPriceCents?: number;
  additionalPriceCents?: number;
  percentual?: number;
  /** Usado por percentual_valor_declarado — incide sobre o valor do pedido (Gris, Ad Valorem), não sobre o frete. */
  percentualValorDeclarado?: number;
  additionalDays?: number;
}

export interface Rule {
  id: string;
  title: string;
  type: RuleType;
  carrierCode: string | null; // null = aplica a todas
  condition: RuleCondition;
  action: RuleAction;
  priority: number;
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
}

export interface QuoteContext {
  /** Valor final do carrinho, já com desconto aplicado. */
  cartValueCents: number;
  destinationUf: string;
  destinationCep: string;
}

// Contrato de request/response da Nuvemshop Shipping Carrier API.
// Referência: https://tiendanube.github.io/api-documentation/resources/shipping-carrier
export interface NuvemshopQuoteRequest {
  cart_id: string;
  store_id: number;
  currency: string;
  /** Valor final do carrinho — já reflete descontos/promoções aplicados, não é o subtotal bruto. */
  total_price: number;
  origin: { postal_code: string };
  destination: { postal_code: string };
  items: { id: number; quantity: number; grams: number; price: number; free_shipping?: boolean }[];
}

export interface NuvemshopQuoteOption {
  name: string;
  code: string;
  price: number;
  price_merchant?: number;
  currency: string;
  type: "ship" | "pickup";
  /** ISO 8601 — não é número de dias. */
  min_delivery_date: string;
  max_delivery_date: string;
}
