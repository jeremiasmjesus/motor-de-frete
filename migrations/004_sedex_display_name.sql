-- "Correios" é a empresa; "Sedex" é a modalidade de frete que de fato aparece
-- pro cliente como opção de entrega. O code interno continua 'correios' (é
-- o que liga com a API deles) — só o nome exibido muda.
update carriers set name = 'Sedex' where code = 'correios';
