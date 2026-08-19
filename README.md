# n8n-nodes-opcua

Nó comunitário do [n8n](https://n8n.io/) para ler, escrever e navegar dados em servidores OPC UA, incluindo PLCs, gateways industriais e servidores SCADA compatíveis.

> Este pacote exige a biblioteca `node-opcua-client` em tempo de execução e, por isso, destina-se a instâncias **self-hosted** do n8n. Ele não é elegível para n8n Cloud.

## Índice

- [Instalação](#instalação)
- [Pré-requisitos](#pré-requisitos)
- [Credencial OPC UA API](#credencial-opc-ua-api)
- [Usando o node](#usando-o-node)
- [Operações](#operações)
- [Formatos de Node ID](#formatos-de-node-id)
- [Saída e tratamento de erros](#saída-e-tratamento-de-erros)
- [Segurança](#segurança)
- [Limitações atuais](#limitações-atuais)
- [Compatibilidade](#compatibilidade)
- [Desenvolvimento](#desenvolvimento)
- [Créditos e licença](#créditos-e-licença)

## Instalação

Em uma instalação self-hosted do n8n, acesse **Settings → Community Nodes → Install**, informe `n8n-nodes-opcua` e confirme a instalação. Veja também a [documentação oficial de community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).

Para desenvolvimento local:

```bash
npm install
npm run build
npm run dev
```

`npm run dev` abre o n8n localmente com hot reload. Em ambientes que bloqueiam a compilação de dependências nativas, use uma versão do Node.js suportada pela versão instalada do n8n.

## Pré-requisitos

- Uma instância n8n com rota de rede até o endpoint OPC UA.
- O endereço e a porta do servidor, normalmente no formato `opc.tcp://HOST:PORTA`.
- Node IDs ou permissão para navegar o espaço de endereços do servidor.
- Credenciais de usuário, caso o endpoint não aceite sessão anônima.
- Para endpoints protegidos, os mesmos modo e política de segurança configurados no servidor.
- Permissão de leitura e/ou escrita para os nós desejados no PLC ou servidor.

## Credencial OPC UA API

Crie uma credencial **OPC UA API** no node. O botão de teste tenta conectar e criar uma sessão; portanto, ele valida rede, segurança e autenticação.

| Campo | Descrição |
| --- | --- |
| **Endpoint URL** | URL OPC UA do equipamento. Exemplo: `opc.tcp://192.168.1.10:4840`. |
| **Security Mode** | `None`, `Sign` ou `Sign and Encrypt`; deve ser idêntico ao endpoint selecionado no servidor. |
| **Security Policy** | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` ou `Aes256_Sha256_RsaPss`. |
| **Authentication** | `Anonymous` ou `Username and Password`. |
| **Username / Password** | Obrigatórios quando a autenticação por usuário for selecionada. A senha é armazenada criptografada pelo n8n. |
| **Connection Timeout** | Tempo máximo de conexão em milissegundos. O padrão é `10000`. |

Comece com `None` somente se o servidor estiver configurado para isso e a rede for confiável. Em produção, prefira o endpoint com segurança mais forte que seja compatível com o PLC.

## Usando o node

O node aparece como **OPC UA** na lista do n8n e tem o nome técnico `opcUa`.

Fluxo inicial recomendado:

1. Adicione um **Manual Trigger** ou **Schedule Trigger**.
2. Adicione o node **OPC UA** e conecte-o ao trigger.
3. Configure a credencial **OPC UA API**.
4. Execute **Browse** em `ObjectsFolder` para localizar tags expostas pelo servidor.
5. Copie o Node ID retornado e use-o em **Read** ou **Write**.

## Operações

### Browse

Navega as referências de um nó OPC UA e ajuda a descobrir o espaço de endereços.

| Campo | Descrição |
| --- | --- |
| **Node ID** | Nó de origem. O valor inicial `ObjectsFolder` é um ponto de partida comum. |
| **Direction** | `Forward`, `Inverse` ou `Both`. Em geral, use `Forward` para listar filhos. |

Exemplo: use `ObjectsFolder` e procure nas referências por objetos e variáveis publicados pelo PLC. Cada referência retornada contém `nodeId`, `browseName`, `displayName`, `nodeClass`, `referenceTypeId` e `isForward`.

### Read

Lê o atributo `Value` de um ou mais Node IDs na mesma sessão OPC UA.

Em **Nodes**, adicione uma entrada para cada tag. Exemplo de Node ID:

```text
ns=2;s=Machine.Temperature
```

Para cada tag, a saída inclui:

```json
{
  "nodeId": "ns=2;s=Machine.Temperature",
  "value": 23.7,
  "dataType": 11,
  "statusCode": "Good (0x00000000)",
  "sourceTimestamp": "2026-08-19T12:00:00.000Z",
  "serverTimestamp": "2026-08-19T12:00:00.010Z"
}
```

`dataType` usa o identificador numérico do tipo OPC UA. `statusCode` deve indicar qualidade boa antes que o valor seja usado em decisões de processo.

### Write

Escreve o atributo `Value` de um ou mais nós. Use somente tags configuradas como graváveis e aplique a política operacional da planta antes de alterar qualquer setpoint ou comando.

Para cada entrada, informe:

- **Node ID**: tag gravável no servidor OPC UA.
- **Data Type**: tipo OPC UA do valor.
- **Value**: valor fixo ou uma expressão n8n, por exemplo `={{ $json.setpoint }}`.

Tipos escalares suportados:

| Tipo no node | Uso esperado |
| --- | --- |
| `Boolean` | `true` ou `false` |
| `SByte`, `Byte`, `Int16`, `UInt16`, `Int32`, `UInt32` | números inteiros dentro do intervalo do tipo no PLC |
| `Float`, `Double` | números decimais |
| `String` | texto |
| `Date and Time` | data ISO 8601, por exemplo `2026-08-19T12:00:00Z` |

A resposta informa o `statusCode` de cada escrita. Uma resposta da requisição sem erro não substitui a verificação desse status por tag.

## Formatos de Node ID

Os Node IDs dependem do servidor. Formatos comuns:

| Formato | Exemplo |
| --- | --- |
| String | `ns=2;s=Machine.Temperature` |
| Numérico | `ns=3;i=1001` |
| Nó padrão | `ObjectsFolder` |

Não tente deduzir o namespace. Use **Browse** ou a documentação do fabricante para obter o ID exato.

## Saída e tratamento de erros

Cada item de entrada gera um item de saída. Operações de leitura e escrita retornam uma propriedade `values`; Browse retorna `references`.

Se **Continue On Fail** estiver habilitado no n8n, uma falha é retornada no item como:

```json
{ "error": "Mensagem recebida do cliente ou servidor OPC UA" }
```

Caso contrário, o workflow para e o n8n mostra o erro da operação. Erros de autenticação, certificado, conexão, Node ID inválido e falta de permissão devem ser tratados antes de colocar o workflow em produção.

## Segurança

- Não exponha endpoints OPC UA diretamente à internet.
- Restrinja o acesso de rede do n8n aos PLCs e use segmentação industrial apropriada.
- Selecione no node exatamente o modo e a política disponibilizados pelo endpoint OPC UA escolhido.
- Para `Sign` e `Sign and Encrypt`, o servidor pode exigir que o certificado do cliente seja confiável. Consulte o procedimento do fabricante do PLC/servidor para aprovar o cliente n8n.
- Dê ao usuário OPC UA somente as permissões necessárias; mantenha escrita desabilitada quando o workflow apenas monitora dados.
- Teste comandos de escrita em ambiente seguro antes de conectá-los a atuadores ou setpoints de produção.

## Limitações atuais

Esta versão implementa operações pontuais de Browse, Read e Write. Ela não implementa subscriptions/monitoramento contínuo, chamadas de métodos OPC UA, histórico, escrita de arrays, ByteString, estruturas/ExtensionObjects ou certificados de cliente fornecidos manualmente na interface. Para coleta contínua, execute leituras com um **Schedule Trigger** em intervalo adequado ao processo.

## Compatibilidade

O pacote usa `node-opcua-client` 2.x e uma versão de n8n compatível com o `n8n-workflow` declarado no `package.json`. A compatibilidade do endpoint depende do perfil OPC UA, política de segurança e autenticação oferecidos pelo equipamento.

## Desenvolvimento

```bash
npm run build
npm run lint
npm run dev
```

Os guias adicionais estão em [Configuração](docs/CONFIGURATION.md) e [Solução de problemas](docs/TROUBLESHOOTING.md).

## Créditos e licença

Criado e mantido por **Emilio Grano Junior** (<egjr78@gmail.com>).

- n8n é usado como plataforma de automação. Consulte a [licença do n8n](https://docs.n8n.io/sustainable-use-license/).
- A comunicação OPC UA usa [`node-opcua-client`](https://github.com/node-opcua/node-opcua), criado por **Etienne Rossignon** e distribuído sob licença MIT.
- OPC UA é uma tecnologia da [OPC Foundation](https://opcfoundation.org/).

Este projeto é distribuído sob a licença MIT. Veja [CREDITS.md](CREDITS.md) para atribuições e referências completas.

## Histórico de versões

### 0.1.0

- Primeira versão com credencial OPC UA, Browse, Read, Write e teste de conexão.
