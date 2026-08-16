# Motor de Frete

Motor de cotação e regras de frete para o checkout da Nuvemshop. Correios cotado ao
vivo via API; Loggi e J&T Express por tabela importada.

## Setup

```bash
cp .env.example .env   # preencher DATABASE_URL e CREDENTIALS_KEY
npm install
npm run migrate
npm run seed:admin -- "Seu Nome" voce@nalisa.com.br senhaForte123
npm run dev
```

Abra `http://localhost:3000/painel/login.html` — dali dá pra:

- cadastrar/atualizar as credenciais dos Correios e testar a conexão de verdade
  (faz uma cotação de amostra, não só valida a senha)
- subir a tabela de preço da Loggi e da J&T Express (CSV ou XLSX), com validação
  linha a linha antes de gravar

Usuários **admin** gerenciam credenciais dos Correios e outros usuários. Usuários
**operador** mexem em tabelas e regras, mas não em credenciais nem em contas.

## Endpoints

- `POST /quote` — contrato de cotação da Nuvemshop Shipping Carrier API
- `POST /auth/login` — login, devolve JWT
- `GET/POST /users` — gestão de usuários (admin)
- `GET/PUT /admin/correios/credentials`, `POST /admin/correios/credentials/test` (admin)
- `GET /admin/carriers`, `POST /admin/carriers/:code/rate-table` (admin ou operador)

## Testes

```bash
npm test
```
