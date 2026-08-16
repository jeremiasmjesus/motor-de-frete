const TOKEN_URL = "https://api.correios.com.br/token/v1/autentica/cartaopostagem";
const PRICE_URL = "https://api.correios.com.br/preco/v1/nacional";

export const CORREIOS_SERVICE_CODES = {
  SEDEX: "03220",
  PAC: "03298",
} as const;

interface TokenResponse {
  token: string;
  expiraEm: string; // ISO date
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function fetchToken(): Promise<string> {
  const user = process.env.CORREIOS_USER;
  const password = process.env.CORREIOS_PASSWORD;
  const cartaoPostagem = process.env.CORREIOS_CARTAO_POSTAGEM;

  if (!user || !password || !cartaoPostagem) {
    throw new Error("Credenciais dos Correios ausentes (CORREIOS_USER / CORREIOS_PASSWORD / CORREIOS_CARTAO_POSTAGEM).");
  }

  const basic = Buffer.from(`${user}:${password}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ numero: cartaoPostagem }),
  });

  if (!res.ok) {
    throw new Error(`Falha ao autenticar nos Correios: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as TokenResponse;
  return data.token;
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }
  const token = await fetchToken();
  // Correios não retorna sempre um "expiraEm" utilizável de forma simples;
  // usamos uma validade conservadora de 3h e renovamos antes de vencer.
  cachedToken = { token, expiresAt: now + 3 * 60 * 60 * 1000 };
  return token;
}

export interface CorreiosQuoteParams {
  cepOrigem: string;
  cepDestino: string;
  pesoGramas: number;
  coProduto?: string;
}

export interface CorreiosQuoteResult {
  coProduto: string;
  precoCentavos: number;
  pesoTaxadoGramas: number;
}

export async function getCorreiosQuote(params: CorreiosQuoteParams): Promise<CorreiosQuoteResult> {
  const token = await getToken();
  const coProduto = params.coProduto ?? CORREIOS_SERVICE_CODES.SEDEX;

  const url = new URL(`${PRICE_URL}/${coProduto}`);
  url.searchParams.set("cepOrigem", params.cepOrigem);
  url.searchParams.set("cepDestino", params.cepDestino);
  url.searchParams.set("psObjeto", String(params.pesoGramas));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Falha ao consultar preço nos Correios: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { coProduto: string; pcFinal: string; psCobrado: string };

  return {
    coProduto: data.coProduto,
    precoCentavos: Math.round(parseFloat(data.pcFinal.replace(",", ".")) * 100),
    pesoTaxadoGramas: parseFloat(data.psCobrado.replace(",", ".")),
  };
}
