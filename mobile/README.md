# Agendaê no celular — Expo

App Android/iOS em Expo SDK 57, React Native, TypeScript e Expo Router. Usa o mesmo backend do PWA: `https://agendae-pwa.vercel.app`.

## Abrir no celular

Na raiz do repositório, `./iniciar-expo.ps1` inicia um túnel público para compartilhar o QR Code com pessoas em outras redes. O script escolhe uma porta livre. Para usar somente a rede local, execute `./iniciar-expo.ps1 -RedeLocal`. O túnel funciona enquanto o computador e o servidor Expo estiverem ligados; o endereço pode mudar ao reiniciar. Cada pessoa precisa de um Expo Go compatível com SDK 57 e deve usar sua própria conta Agendaê para as consultas.

Na pasta `mobile`:

```sh
npm ci
npm start
```

Instale Expo Go compatível com SDK 57 no celular. Deixe celular e computador na mesma rede e escaneie o QR Code exibido no terminal. No Android use Expo Go; no iPhone use a câmera. Quando exigido pelo Expo Go, entre na mesma conta Expo no computador e no celular. Consulte [a configuração oficial do dispositivo](https://docs.expo.dev/get-started/set-up-your-environment/).

Se a rede bloquear a conexão local, execute `npx expo start --tunnel` e aceite a instalação do suporte de túnel quando solicitada. Isso disponibiliza o servidor de desenvolvimento durante a sessão; não publica um aplicativo nas lojas. Se a versão do Expo Go não corresponder ao SDK, consulte [o guia de compatibilidade](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/).

## Conexão com o banco

```text
Expo → API HTTPS na Vercel → Firebase Admin → Cloud Firestore
PWA  → mesma API          → mesmo projeto e mesmas consultas
```

O app requer Firestore configurado no backend. Não utiliza SQLite nem demonstração local, e não salva consultas em arquivos no celular. As contas e consultas são persistidas no servidor. O catálogo público de unidades fictícias vem da API e permanece estático nesta etapa. Relatos da triagem não são armazenados no banco.

Configure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` **na Vercel**, conforme [o guia Firebase](../docs/FIREBASE.md), e faça novo deployment. A IA exige `OPENAI_API_KEY` separadamente. Não coloque nenhuma dessas chaves no app.

Para outro backend, copie `.env.example` para `.env.local`, altere `EXPO_PUBLIC_API_URL` e reinicie o Expo. Essa variável é pública e contém somente a URL. O app verifica `database: "firestore"` em `/api/status`; presença de configuração não garante conexão real. As funções precisam ter acesso ao banco.

## Funcionalidades

- Cadastro com consentimento, login, restauração de sessão e logout.
- Criar, listar, editar e cancelar consultas da conta.
- Consultar disponibilidade compartilhada entre usuários.
- Atualização periódica a cada 5 segundos enquanto a tela está ativa, com atualização ao retornar ao app.
- Orientação com IA usando o backend; alternativa manual quando indisponível.

`/api/mobile-auth` retorna um token opaco, guardado no Expo SecureStore e enviado como `Authorization: Bearer`. O banco guarda apenas seu hash. A sessão expira em sete dias e é revogada no logout. O PWA mantém cookies HttpOnly e não recebe tokens no JSON de login.

Sem internet, não são feitas alterações locais ou sincronização posterior. Consultas já carregadas permanecem apenas na memória e podem ser lidas durante a sessão; erros de conexão são exibidos. O PWA original mantém seu App Shell e a demonstração offline. Não há Firebase Authentication; ambos os clientes usam a autenticação própria do backend.

## Validar

```sh
npm run typecheck
npm run lint
npm run export
npx expo-doctor
```

Na raiz, `npm test` inclui autenticação móvel, CRUD compartilhado com o site, isolamento entre contas e revogação de sessão. Esses testes usam SQLite local; não comprovam conexão com o Firebase real. Use `npm run test:firebase` na raiz após configurar as credenciais para testar o banco real.

## Gerar APK opcional

Com sua conta Expo autenticada:

```sh
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

`eas.json` prepara um APK para distribuição interna. O build depende de acesso à conta Expo e das condições do serviço; não foi criado ou enviado às lojas nesta entrega. Testes em um celular físico ainda são necessários para validar teclado, navegação, chamadas e persistência da sessão.
