# Solução de problemas

## Timeout ou conexão recusada

Verifique o endpoint, a porta, DNS, firewall, VPN, roteamento e se o serviço OPC UA está ativo. Execute a verificação a partir do host ou container do n8n, e não apenas da estação do operador.

## Falha de segurança ou certificado

Confirme que Security Mode e Security Policy na credencial correspondem ao endpoint selecionado no servidor. Em endpoints assinados ou criptografados, aprove o certificado do cliente no trust list do PLC/servidor conforme a documentação do fabricante.

## Falha de autenticação

Confira o tipo de autenticação permitido pelo endpoint. Um usuário OPC UA pode ter permissões distintas de uma conta de engenharia, web ou sistema operacional. Teste novamente a credencial após alterar usuário, senha ou permissões.

## Node ID desconhecido

Use **Browse** para recuperar o Node ID exato. Confirme namespace, identificador numérico/string e diferenças entre maiúsculas e minúsculas em IDs do tipo string.

## Escrita retornou status diferente de Good

O servidor recebeu a requisição, mas pode ter recusado a alteração. Motivos frequentes são variável somente leitura, tipo incompatível, valor fora de faixa, usuário sem permissão ou intertravamento no PLC. Verifique o `statusCode` e os diagnósticos do servidor.

## Valor inesperado

Confirme unidade, escala, tipo, endianness no gateway e qualidade do dado no PLC. Valores com qualidade diferente de `Good` não devem ser usados como dado de processo confiável.

## Preciso de monitoramento contínuo

Esta versão não cria subscriptions OPC UA. Use um **Schedule Trigger** e a operação **Read** para polling, escolhendo uma frequência que não sobrecarregue o PLC nem a rede industrial.
