-- Gris, Ad Valorem etc — percentual que incide sobre o valor declarado do
-- pedido (não sobre o preço do frete, diferente do tipo "percentual" que já existia).
alter type rule_type add value 'percentual_valor_declarado';
