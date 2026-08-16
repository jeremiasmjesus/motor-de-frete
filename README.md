# Motor de Frete

Motor de cotação e regras de frete para o checkout da Nuvemshop. Correios cotado ao
vivo via API; Loggi e J&T Express por tabela importada.

## Setup

```bash
cp .env.example .env   # preencher DATABASE_URL e credenciais dos Correios
npm install
npm run migrate
npm run seed:admin -- "Seu Nome" voce@nalisa.com.br senhaForte123
npm run dev
```

## Endpoints

- `POST /quote` — contrato de cotação da Nuvemshop Shipping Carrier API
- `POST /auth/login` — login, devolve JWT
- `GET/POST /users` — gestão de usuários (admin)

## Testes

```bash
npm test
```
