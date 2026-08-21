const TOKEN_URL = "https://www.tiendanube.com/apps/authorize/token";
const API_BASE = "https://api.nuvemshop.com.br/2025-03";
const USER_AGENT = "Motor de Frete Nalisa (jeremias@nalisa.com.br)";

export interface TokenExchangeResult {
  accessToken: string;
  storeId: string;
}

/** Troca o "code" que a Nuvemshop manda no callback por um access_token da loja. */
export async function exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
  const clientId = process.env.NUVEMSHOP_CLIENT_ID;
  const clientSecret = process.env.NUVEMSHOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NUVEMSHOP_CLIENT_ID / NUVEMSHOP_CLIENT_SECRET não configurados no servidor.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao trocar código por token: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; user_id: string | number };
  return { accessToken: data.access_token, storeId: String(data.user_id) };
}

export interface ShippingCarrierResult {
  id: number;
  name: string;
  callback_url: string;
}

/** Cadastra (ou atualiza, se já existir) o Motor de Frete como transportadora na loja. */
export async function createShippingCarrier(
  storeId: string,
  accessToken: string,
  callbackUrl: string,
): Promise<ShippingCarrierResult> {
  const res = await fetch(`${API_BASE}/${storeId}/shipping_carriers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      name: "Motor de Frete Nalisa",
      callback_url: callbackUrl,
      types: "ship",
      active: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao cadastrar a transportadora na Nuvemshop: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<ShippingCarrierResult>;
}

export interface ShippingCarrierOptionInput {
  code: string;
  name: string;
}

/**
 * A Nuvemshop só chama o callback_url pra transportadoras que têm ao menos uma
 * "option" cadastrada, e usa o campo `code` da option pra casar com o `code`
 * que a gente devolve em cada rate no /quote. Sem isso, o checkout não pede
 * cotação nenhuma pra transportadora — mesmo com ela "active".
 */
export async function createShippingCarrierOptions(
  storeId: string,
  accessToken: string,
  carrierId: number,
  options: ShippingCarrierOptionInput[],
): Promise<void> {
  for (const option of options) {
    const res = await fetch(`${API_BASE}/${storeId}/shipping_carriers/${carrierId}/options`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ code: option.code, name: option.name, active: true }),
    });

    if (!res.ok) {
      throw new Error(
        `Falha ao cadastrar a opção "${option.name}" (${option.code}) na Nuvemshop: ${res.status} ${await res.text()}`,
      );
    }
  }
}
