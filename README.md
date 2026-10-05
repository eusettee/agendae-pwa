# Agendaê — Saúde na Palma da Mão

P.I SENAC: PWA para agendamento acadêmico, com cadastro, login, CRUD de consultas e pré-triagem com OpenAI. Interface simples em português. Unidades e profissionais fictícios.

## Executar

Requer Node.js 24. Instale as dependências antes do primeiro acesso. Localmente, o banco SQLite é criado automaticamente em `data/` (ignorado pelo Git). Em produção, use PostgreSQL Neon ou Supabase.

```sh
npm ci
npm start
```

Abra **http://localhost:3000**. Não abra o HTML diretamente: Service Worker precisa de localhost ou HTTPS.

## O que está pronto

- Início, agendamento, consultas, ajuda, cadastro/login e pré-triagem.
- Especialidade → unidade → profissional → data → horário.
- CRUD completo: criar, listar, editar/reagendar e excluir/cancelar consultas.
- Na conta: persistência no banco, isolamento por usuário e restrição UNIQUE de horário, mesmo entre pacientes distintos.
- Sem login: demonstração local, inclusive offline, sem integração com as consultas do servidor.
- Senhas com scrypt, sessões opacas com expiração de sete dias e cookie HttpOnly/SameSite/Secure em produção; proteção de origem e limites de tentativas.
- API: `GET/POST /api/auth`, `GET/POST/PUT/DELETE /api/appointments`, `GET /api/availability`, `GET /api/catalog`, `GET /api/status` e `POST /api/triage`.
- Manifest com nome, cores, ícones 192/512, ícone maskable e standalone.
- Service Worker com cache do HTML, CSS, JS, catálogo e ícones.
- Operação offline após primeiro acesso: abrir, criar, listar, editar e cancelar na demonstração. Contas e IA requerem internet.
- IA autenticada via Responses API: JSON validado, especialidade permitida, consentimento e alternativa manual. Falhas e ausência de chave não são apresentadas como resultados de IA.
- Instalação oferecida pelo navegador quando suportada; instruções em Ajuda.

## Escopo e dados

**Demonstração acadêmica: nenhuma consulta real é marcada.** Todos os profissionais e unidades são fictícios. Use dados fictícios. Na conta, os agendamentos ficam no banco e só podem ser vistos e alterados pelo proprietário. Na demonstração sem login, ficam no `localStorage` deste navegador e podem ser apagados em Ajuda. Não há importação automática entre os dois modos.

A API valida e persiste as consultas da conta. A restrição do banco impede conflitos de horário entre contas, e cancelar libera o horário. Dados de conta, cookies e respostas da API não entram no cache do Service Worker; a consulta offline é exclusiva do modo demonstração. O catálogo do backend possui cópia local: atualize com `node tools/generate-assets.cjs`.

Os documentos orientaram o domínio e o fluxo. A ampliação solicitada acrescentou login, persistência e IA. Ainda não existem painel administrativo, CRUD de clínicas/profissionais, CPF, recuperação de senha, verificação de e-mail ou integração com clínicas reais. As sessões são armazenadas no banco em vez de JWT. A pré-triagem é experimental, não faz diagnóstico, não prescreve e precisa de validação por profissionais.

## Ativar banco e IA na Vercel

1. Projeto `agendae-pwa` → Storage → Create Database → Neon (Free) ou Supabase. Conecte o banco ao projeto e ao ambiente Production.
2. Em Settings → Environment Variables, confirme `DATABASE_URL` ou `POSTGRES_URL` com a conexão **pooled** do PostgreSQL e TLS, fornecida pelo provedor.
3. Adicione `OPENAI_API_KEY` como segredo no ambiente Production. Opcional: `OPENAI_MODEL` (padrão `gpt-4.1-mini`). A chave nunca chega ao navegador. O consumo da API depende da conta OpenAI.
4. Faça um novo deploy depois de configurar as variáveis. As tabelas de `migrations/001-initial.sql` são criadas no primeiro uso do banco.
5. Crie uma conta fictícia, agende, edite, cancele e teste a pré-triagem. Sem banco configurado, o site informa que o login está em configuração; a demonstração continua disponível.

Para usar as mesmas integrações localmente, copie `.env.example` para `.env.local` e preencha os valores. Nunca envie segredos ao GitHub ou ao chat.

A pré-triagem envia apenas sintomas, duração e intensidade à OpenAI, com consentimento; não envia o e-mail ou nome da conta. O relato não é salvo no banco ou em cache. Cada conta pode fazer cinco consultas por hora. Não use dados clínicos reais na apresentação. A opção `store:false` desativa o armazenamento da resposta para recuperação na API, mas não equivale a garantia de retenção zero pelo provedor. A saída estruturada segue a [documentação oficial da OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Estrutura

```text
public/         Front-end, manifest, service worker e ícones
api/            Funções serverless compatíveis com Vercel
lib/            Catálogo e regras de validação do backend
server.cjs      Servidor local Node.js
migrations/     Esquema SQL para SQLite/PostgreSQL
tests/          Testes de regras, API e navegador
tools/          Geração dos ícones e do catálogo offline
vercel.json     Configuração da hospedagem
```

## Testes

```sh
npm ci
npm test
npm run test:e2e
```

Os testes usam Google Chrome instalado. Verificam cadastro/login/logout, CRUD, isolamento entre contas, conflitos, persistência após recarregar, modo offline, cache, manifest e responsividade. A chamada OpenAI é simulada nos testes; a integração real só pode ser verificada com uma chave válida. O Chrome confirmou elegibilidade de instalação; a instalação efetiva deve ser demonstrada manualmente. Capturas ficam em `artifacts/`.

## Apresentação (3 minutos)

1. Início: explicar a proposta de simplificar o agendamento.
2. Agendar: salvar uma consulta fictícia e abrir Consultas.
3. Mostrar `public/manifest.json`: nome, ícones, cores e standalone.
4. Mostrar `public/sw.js`: arquivos essenciais no cache.
5. Em Ajuda, esperar “Modo offline pronto”. No DevTools → Network, selecionar Offline e recarregar.
6. Mostrar a consulta salva; cancelar e criar outra offline.
7. Instalar usando o botão, se oferecido. Para verificar: DevTools → Application → Manifest e Service Workers. No iPhone: Safari → Compartilhar → Adicionar à Tela de Início.
8. Com banco e OpenAI configurados: criar conta, editar a consulta e mostrar a pré-triagem sugerindo uma especialidade.
9. Próximos passos: perfis administrativos, recuperação de acesso, validação clínica e integração com unidades reais.

## Publicação no GitHub e Vercel

O pedido autoriza publicar o projeto. Requer autenticação válida nos dois serviços. Execute no PowerShell:

```powershell
.\publicar.ps1
```

O script cria um repositório **privado** `agendae-pwa` no GitHub e faz deploy de produção na Vercel. A URL do site é pública e contém apenas dados fictícios. Ele não publica os documentos fornecidos nem arquivos de credenciais. O projeto usa a configuração “Other” com saída `public` e funções em `api`, conforme a [documentação da Vercel](https://vercel.com/docs/project-configuration/vercel-json).

O script também executa `vercel git connect --yes` para ativar os próximos deploys por push, conforme a [documentação da integração Git](https://vercel.com/docs/cli/git). A conta Vercel precisa ter acesso ao repositório GitHub; se faltar essa autorização, o script informa a pendência. Sem conectar os serviços, o projeto continua disponível localmente.
