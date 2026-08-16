import { loadCorreiosCredentials } from "./credentials.js";

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

/** Chamar sempre que as credenciais forem alteradas pelo painel, pra não usar um token velho. */
export function invalidateCorreiosTokenCache(): void {
  cachedToken = null;
}

async function fetchToken(): Promise<string> {
  const creds = await loadCorreiosCredentials();
  if (!creds) {
    throw new Error("Credenciais dos Correios não configuradas. Cadastre-as no painel antes de cotar.");
  }

  const basic = Buffer.from(`${creds.user}:${creds.codigoAcesso}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ numero: creds.cartaoPostagem }),
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
  /** Dimensões em cm — quando informadas, os Correios calculam pelo maior entre peso real e peso cubado. */
  dimensoes?: { comprimento: number; largura: number; altura: number };
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

  if (params.dimensoes) {
    url.searchParams.set("tpObjeto", "2"); // pacote — habilita o cálculo por dimensões
    url.searchParams.set("comprimento", String(params.dimensoes.comprimento));
    url.searchParams.set("largura", String(params.dimensoes.largura));
    url.searchParams.set("altura", String(params.dimensoes.altura));
  }

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

export interface CorreiosTestResult {
  ok: boolean;
  message: string;
  sample?: { precoCentavos: number };
}

/**
 * Testa as credenciais salvas fazendo o fluxo completo: autentica e faz uma
 * cotação real de amostra. Autenticar sozinho não garante que o cartão de
 * postagem está corretamente vinculado ao contrato — só a cotação confirma isso.
 */
export async function testCorreiosCredentials(params: {
  cepOrigem: string;
  cepDestino: string;
  pesoGramas: number;
}): Promise<CorreiosTestResult> {
  invalidateCorreiosTokenCache();
  try {
    const result = await getCorreiosQuote(params);
    return {
      ok: true,
      message: "Conexão validada — autenticação e cotação de teste funcionaram.",
      sample: { precoCentavos: result.precoCentavos },
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Erro desconhecido ao testar." };
  }
}
