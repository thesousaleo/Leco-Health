# Leco Health

App de saúde, performance e hábitos: treino, nutrição, hábitos, biometria e sono. Cada pessoa tem sua conta, e amigos acompanham o progresso uns dos outros.

## Baixar o APK (Android)

A cada envio para `main`, o GitHub Actions compila o app e publica o APK em **Releases**:
`https://github.com/thesousaleo/leco-health/releases/latest`

No celular, baixe o arquivo `LecoHealth-v1.0.X.apk` e toque para instalar. Se o Android pedir, permita **instalar apps desconhecidos** para o navegador ou para o gerenciador de arquivos.

## Contas e amigos

- **Login:** e-mail e senha pelo Supabase Auth. O app também funciona sem conta, com os dados salvos só no aparelho.
- **Sincronização:** com conta, o estado completo é salvo na tabela `user_state`, que só o dono lê. Isso vale como backup e para usar em mais de um aparelho.
- **Amigos:** cada perfil tem um código de 6 caracteres. Um amigo digita o seu código e o pedido fica pendente até você aceitar. Se os dois enviarem o código um para o outro, a amizade é aceita na hora.
- **O que o amigo vê:** só a tabela `progress`, com score do dia, últimos 14 dias, sequência, treinos da semana, hábitos de hoje e aderência à dieta. Peso aparece apenas se você ativar em Ajustes. Diário, exames e refeições nunca são compartilhados.
- **Segurança:** as regras ficam no próprio banco, com RLS. O esquema está em `supabase/migrations/`.

## Desenvolvimento

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # gera dist/
npm run android:sync   # build + copia para o projeto Android (depois de `npx cap add android`)
```

Stack:
- React 19 + TypeScript, Vite e Tailwind CSS v4.
- Ícones Lucide, pelo pacote `react-icons/lu`.
- Gráficos em SVG próprio.
- Capacitor 7 para Android.

O cliente Supabase (`src/cloud.ts`) usa só `fetch`, sem SDK. As chaves públicas ficam em `src/config.ts`.

## Estrutura

```
src/
  App.tsx              navegação (sidebar no desktop, barra inferior no celular)
  store.tsx            estado central + ações + persistência local
  sync.tsx             conta, sincronização e amigos
  cloud.ts             Auth/REST do Supabase via fetch
  pages/               Início, Treino, Nutrição, Hábitos, Registros, Amigos, Ajustes
  components/          design system (ui.tsx), gráficos, timer de descanso, login
supabase/migrations/   tabelas, funções e políticas RLS
.github/workflows/     build do APK e publicação em Releases
assets/                ícone e splash do app
```
