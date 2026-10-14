# novatar on Vercel

A minimal, deployable avatar API using [novatar](../../README.md).

## Deploy in 60 seconds

```bash
cd examples/vercel-api
npm install
npx vercel        # link + deploy
```

Or from an AI agent sandbox (Vercel Computer):

```bash
git clone <your-fork> && cd your-fork/examples/vercel-api
npm install
npx vercel --yes --prod
```

## Routes

| Route                         | Output | Notes                                  |
| ----------------------------- | ------ | -------------------------------------- |
| `/api/avatar`                 | JSON   | Route documentation                    |
| `/api/avatar/:seed`           | SVG    | Deterministic avatar for the seed      |
| `/api/avatar/:seed.png`       | PNG    | Rasterized (512px default, `?size=`)   |
| `/api/avatar/:seed.json`      | JSON   | Metadata + ready-to-use `dataUri`      |
| `/api/avatar/styles`          | JSON   | Full style catalog                     |

Query parameters: `engine` (avatars \| duo \| auto), `variant`, `shape`,
`expression`, `background`, `size`, `circle`, `effect`, `animate`, `colors`
(5 comma-separated hex values), `format` (overrides the path extension).

Responses are deterministic, so they carry
`Cache-Control: public, max-age=31536000, immutable`.

## Local development

```bash
npm install
npx vercel dev
# http://localhost:3000/api/avatar/orion?engine=avatars&variant=triton
```

## Using the deployment from Notion

Deployed URLs can be used directly as external image URLs:

```
https://<your-app>.vercel.app/api/avatar/justin.png?engine=duo&shape=cat&expression=loving
```

Notion image blocks accept external URLs, so an agent can attach avatars to
pages without uploading files.
