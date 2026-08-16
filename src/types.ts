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
}

export type RuleType =
  | "valor_fixo"
  | "valor_fixo_adicional"
  | "percentual"
  | "frete_gratis"
  | "acrescimo_prazo";

export interface RuleCondition {
  cartValueMinCents?: number;
  ufIn?: string[];
  carrierCode?: string;
}

export interface RuleAction {
  fixedPriceCents?: number;
  additionalPriceCents?: number;
  percentual?: number;
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
  cartValueCents: number;
  destinationUf: string;
}

// Contrato de request/response da Nuvemshop Shipping Carrier API
export interface NuvemshopQuoteRequest {
  cart: { currency: string; subtotal: number };
  origin: { zipcode: string };
  destination: { zipcode: string };
  items: { quantity: number; grams: number }[];
}

export interface NuvemshopQuoteOption {
  name: string;
  code: string;
  price: number;
  currency: string;
  min_delivery_date: number;
  max_delivery_date: number;
}
