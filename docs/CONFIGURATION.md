# Configuração do OPC UA

Este guia descreve como preparar o servidor e o n8n para usar o node **OPC UA**.

## 1. Identifique o endpoint

Obtenha do fabricante ou administrador o endpoint OPC UA completo, por exemplo:

```text
opc.tcp://192.168.10.20:4840
```

Confirme que o host onde o n8n executa consegue alcançar a porta TCP. O endpoint pode usar outra porta e não deve ser confundido com interfaces web, Modbus TCP ou drivers proprietários do PLC.

## 2. Escolha segurança e autenticação

No servidor OPC UA, identifique uma combinação de endpoint com modo de segurança, política de segurança, tipo de token do usuário e permissões para as variáveis desejadas.

Configure a credencial n8n com a mesma combinação. Não basta que o nome da política seja semelhante: ela precisa coincidir com o endpoint efetivamente publicado pelo servidor.

## 3. Crie e teste a credencial

No node **OPC UA**, em **Credential to connect with**, crie uma credencial **OPC UA API**. Preencha o endpoint, a segurança e a autenticação. Use o botão de teste antes de configurar operações do workflow.

Se a sessão não puder ser criada, consulte [Solução de problemas](TROUBLESHOOTING.md).

## 4. Descubra tags

Selecione **Browse**, mantenha `ObjectsFolder` como Node ID e execute o workflow manualmente. Navegue progressivamente pelos Node IDs retornados até localizar a variável do processo.

O Node ID é fornecido pelo servidor e pode mudar entre modelos, projetos de PLC ou configurações de namespace. Guarde-o como configuração do workflow; não crie IDs por suposição.

## 5. Leia valores

Selecione **Read** e adicione os Node IDs encontrados. A qualidade é informada por `statusCode`. Use um node **IF** ou **Code** posterior se o workflow só puder continuar quando o status for `Good`.

## 6. Escreva com segurança

Antes de selecionar **Write**:

1. Confirme com a equipe de automação que a variável pode ser escrita externamente.
2. Confira o tipo OPC UA da variável.
3. Teste em ambiente não produtivo ou com um valor seguro.
4. Confirme o `statusCode` retornado pela escrita.

O node não executa intertravamentos de processo. Esses controles devem existir no PLC, no sistema de segurança e no workflow.
