import { NextRequest, NextResponse } from 'next/server';

/**
 * Dynamic Runtime Reverse Proxy for EcoSentinel Backend
 * Proxies /api/v1/* requests to the FastAPI backend service.
 * Reads BACKEND_URL at runtime, allowing seamless Cloud Run deployment
 * without requiring the backend URL to be baked in at build time.
 */

const getBackendBaseUrl = (): string => {
  const url =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'http://localhost:8000';
  return url.replace(/\/$/, '');
};

async function handleProxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams?.path || [];
  const targetPath = pathSegments.join('/');
  const search = request.nextUrl.search;
  const backendBase = getBackendBaseUrl();
  const targetUrl = `${backendBase}/api/v1/${targetPath}${search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Avoid forwarding host or connection headers that conflict with backend
    const lowerKey = key.toLowerCase();
    if (!['host', 'connection', 'content-length'].includes(lowerKey)) {
      headers.set(key, value);
    }
  });

  const method = request.method;
  const hasBody = !['GET', 'HEAD'].includes(method);

  let body: BodyInit | null = null;
  if (hasBody) {
    try {
      body = await request.arrayBuffer();
    } catch {
      body = null;
    }
  }

  try {
    const backendResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
      // @ts-expect-error duplex is required in node fetch when streaming
      duplex: 'half',
      cache: 'no-store',
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    backendResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Forward all safe response headers
      if (!['transfer-encoding', 'content-encoding', 'connection'].includes(lowerKey)) {
        responseHeaders.set(key, value);
      }
    });

    const responseBody = await backendResponse.arrayBuffer();

    return new NextResponse(responseBody, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(`[EcoSentinel Proxy Error] Failed to proxy ${method} ${targetUrl}:`, err?.message || err);
    return NextResponse.json(
      {
        error: 'Backend gateway connection failure',
        target: targetUrl,
        message: err?.message || 'Could not reach backend service',
      },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const HEAD = handleProxy;
export const OPTIONS = handleProxy;
