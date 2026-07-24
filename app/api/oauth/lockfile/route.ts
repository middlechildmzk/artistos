import generatedLockfile from './generated';

export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(generatedLockfile, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
