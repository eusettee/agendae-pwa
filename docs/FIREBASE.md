# Configurar o Firebase no Agendaê

O backend usa Cloud Firestore via Firebase Admin SDK. O frontend continua chamando a API da Vercel. Não é necessário configurar Firebase Authentication ou colocar chaves no JavaScript público.

## Configuração realizada

Projeto `agendae-f95c6`, banco `(default)`, região `southamerica-east1` (São Paulo). APIs Firestore e IAM habilitadas; regras versionadas publicadas. A conta dedicada `agendae-vercel@agendae-f95c6.iam.gserviceaccount.com` usa `roles/datastore.user`. As três variáveis Firebase estão configuradas de forma protegida na Vercel, em Production.

Em 05/10/2026, foram validados conexão, transações e CRUD em produção, incluindo cadastro, sessão, disponibilidade compartilhada e logout. Os dados fictícios foram removidos. A cópia local autorizada da chave fica em `.firebase/agendae-service-account.json`, ignorada pelo Git; não a compartilhe. O login da aplicação continua usando sessões próprias, sem Firebase Authentication. A IA ainda exige sua chave OpenAI.

## Projeto e banco

1. Crie um projeto em https://console.firebase.google.com/.
2. Abra Firestore Database → Criar banco de dados.
3. Escolha edição Standard, banco `(default)` e modo produção. Escolha uma região próxima dos usuários; considere também a região das funções Vercel.
4. Em Configurações do projeto → Contas de serviço, gere uma chave privada. Salve o JSON fora desta pasta e não o envie ao GitHub.

## Variáveis na Vercel

Abra agendae-pwa → Settings → Environment Variables e selecione Production:

| Variável | Campo do JSON |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` |

Cole somente o valor de cada campo, sem aspas externas. A chave aceita quebras de linha reais ou a sequência literal `\n`. Não use variáveis públicas. Se usar Preview, configure esse ambiente separadamente, preferencialmente com outro projeto.

Faça um novo deployment após salvar. `GET /api/status` deve retornar `accounts: true` e `database: "firestore"`. Isso confirma presença de configuração; cadastro/login são necessários para confirmar conexão e permissões.

## Regras e permissões

Copie `firestore.rules` para a aba Regras do Firestore e publique. Ela nega todas as leituras e escritas diretas de clientes. O login do Agendaê usa cookies de sessão próprios; não gera tokens Firebase Authentication.

O Admin SDK acessa o banco usando IAM e não depende dessas regras. A conta de serviço precisa de acesso ao Firestore, por exemplo o papel Cloud Datastore User (`roles/datastore.user`). Não conceda acesso público ao banco. Não remova os índices de campo único padrão: as consultas usam filtros de igualdade e mesclagem de índices.

Com Firebase CLI autenticada, também é possível publicar os arquivos versionados:

```sh
firebase deploy --only firestore:rules,firestore:indexes --project SEU_PROJECT_ID
```

## Validar a conexão real

Para teste local, copie `.env.example` para `.env.local`, configure as três variáveis e execute:

```sh
npm run test:firebase
```

O teste cria consultas com identificadores exclusivos, verifica disputa pelo mesmo horário, isolamento, reagendamento e exclusão. Remove as consultas de teste ao terminar. Ele utiliza o banco configurado e pode gerar consumo de leituras e escritas. Uma interrupção abrupta pode deixar documentos de teste; confira as coleções `appointments` e `slots`.

Depois, execute `npm start` e valide cadastro, logout, login e CRUD por duas contas. As coleções são criadas automaticamente na primeira escrita. Não há importação automática do SQLite ou de bancos anteriores.

`npm test` utiliza SQLite e um simulador do contrato do Firestore; não comprova uma conexão real. A IA permanece preparada até configurar `OPENAI_API_KEY` separadamente.

## Emulador opcional

O emulador requer Firebase CLI e uma versão Java compatível com ela. Inicie:

```sh
firebase emulators:start --only firestore --project demo-agendae
```

Em outro terminal, configure `FIREBASE_PROJECT_ID=demo-agendae` e `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, sem credenciais reais. Execute `npm run test:firebase`. O backend rejeita configuração de emulador na Vercel.

## Expiração e manutenção

Sessões vencidas são recusadas imediatamente pela aplicação, independentemente de limpeza do banco. Configure políticas TTL opcionais no campo `deleteAfter` dos grupos de coleção `sessions` e `requestLimits` para remover documentos expirados. A exclusão TTL é assíncrona e pode gerar cobrança; confira as condições do projeto Firebase.

Não habilite TTL em `appointments`, `slots`, `users` ou `uniqueEmails`. Cancelamentos removem consulta e reserva na mesma transação. Proteja e rotacione as chaves privadas; atualize as variáveis e publique novamente após uma rotação.

Referências oficiais: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup), [transações](https://firebase.google.com/docs/firestore/manage-data/transactions) e [emulador Firestore](https://firebase.google.com/docs/emulator-suite/connect_firestore).
