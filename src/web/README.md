# Frontend e experiência — pessoas D e E

Base React + Vite + TypeScript, sem telas de negócio ou dados simulados.

- Pessoa D: `src/pages/CasesList/`, `CaseNew/`, `History/` e `BankDashboard/`.
- Pessoa E: `src/pages/Workspace/` e seus componentes.
- Compartilhado: `src/components/`, `src/api/` e `src/types/`.

`npm run dev` inicia o frontend. Sem `VITE_API_URL`, requisições `/api` são
encaminhadas para `http://127.0.0.1:8000` no desenvolvimento. Na Vercel,
configure `VITE_API_URL` com a origem pública do backend na Railway, sem barra
final. A integração de telas ainda será implementada; `src/api/client.ts`
centraliza a construção das URLs para as pessoas D e E.

Para deploy na Vercel, selecione `src/web` como Root Directory. O arquivo
`vercel.json` configura o build Vite, a saída `dist` e o fallback de SPA.
