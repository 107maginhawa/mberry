import { describe, test, expect, beforeEach } from 'bun:test';
import {
  SdkError,
  errorInterceptor,
  createClientConfig,
  setSdkBaseUrl,
  getSdkBaseUrl,
} from './client';

// -------------------------------------------------------------------------
// SdkError
// -------------------------------------------------------------------------

describe('SdkError', () => {
  test('extends Error', () => {
    const err = new SdkError({ status: 404 });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SdkError);
  });

  test('name is SdkError', () => {
    const err = new SdkError({ status: 500 });
    expect(err.name).toBe('SdkError');
  });

  test('stores status, url, method, body', () => {
    const body = { error: 'not found' };
    const err = new SdkError({
      status: 404,
      url: 'http://localhost:7213/persons/1',
      method: 'GET',
      body,
    });
    expect(err.status).toBe(404);
    expect(err.url).toBe('http://localhost:7213/persons/1');
    expect(err.method).toBe('GET');
    expect(err.body).toBe(body);
  });

  test('uses provided message', () => {
    const err = new SdkError({ status: 422, message: 'validation failed' });
    expect(err.message).toBe('validation failed');
  });

  test('generates default message when no message provided', () => {
    const err = new SdkError({ status: 401, method: 'POST', url: '/auth/login' });
    expect(err.message).toContain('401');
    expect(err.message).toContain('POST');
    expect(err.message).toContain('/auth/login');
  });

  test('handles missing optional fields gracefully', () => {
    const err = new SdkError({ status: 500 });
    expect(err.url).toBeUndefined();
    expect(err.method).toBeUndefined();
    expect(err.body).toBeUndefined();
  });
});

// -------------------------------------------------------------------------
// wrapError (via errorInterceptor)
// -------------------------------------------------------------------------

describe('errorInterceptor (wrapError)', () => {
  test('returns SdkError unchanged when error is already SdkError', () => {
    const existing = new SdkError({ status: 409 });
    const result = errorInterceptor(existing, undefined, undefined);
    expect(result).toBe(existing);
  });

  test('passes through AbortError unchanged', () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    const result = errorInterceptor(abortErr, undefined, undefined);
    expect(result).toBe(abortErr);
  });

  test('passes through error with "aborted" in message', () => {
    const abortErr = new Error('fetch was aborted');
    const result = errorInterceptor(abortErr, undefined, undefined);
    expect(result).toBe(abortErr);
  });

  test('wraps plain object error into SdkError with response status', () => {
    const mockResponse = new Response(null, { status: 422 });
    const bodyError = { message: 'invalid input' };
    const result = errorInterceptor(bodyError, mockResponse, undefined);
    expect(result).toBeInstanceOf(SdkError);
    const sdkErr = result as SdkError;
    expect(sdkErr.status).toBe(422);
    expect(sdkErr.body).toBe(bodyError);
    expect(sdkErr.message).toBe('invalid input');
  });

  test('wraps string error into SdkError', () => {
    const mockResponse = new Response(null, { status: 500 });
    const result = errorInterceptor('server error', mockResponse, undefined);
    expect(result).toBeInstanceOf(SdkError);
    const sdkErr = result as SdkError;
    expect(sdkErr.message).toBe('server error');
    expect(sdkErr.status).toBe(500);
  });

  test('uses status 0 when response is undefined', () => {
    const result = errorInterceptor({ message: 'network error' }, undefined, undefined);
    expect(result).toBeInstanceOf(SdkError);
    expect((result as SdkError).status).toBe(0);
  });

  test('extracts method from request', () => {
    const mockRequest = new Request('http://localhost:7213/persons', { method: 'POST' });
    const mockResponse = new Response(null, { status: 400 });
    const result = errorInterceptor('bad request', mockResponse, mockRequest);
    expect(result).toBeInstanceOf(SdkError);
    expect((result as SdkError).method).toBe('POST');
  });
});

// -------------------------------------------------------------------------
// createClientConfig
// -------------------------------------------------------------------------

describe('createClientConfig', () => {
  beforeEach(() => {
    // Reset to default base URL before each test
    setSdkBaseUrl('http://localhost:7213');
  });

  test('preserves existing config properties', () => {
    const input = { throwOnError: true, someOption: 'value' };
    const result = createClientConfig(input);
    expect((result as typeof input & { throwOnError: boolean }).throwOnError).toBe(true);
    expect((result as typeof input & { someOption: string }).someOption).toBe('value');
  });

  test('merges baseUrl into config', () => {
    const result = createClientConfig({} as Record<string, unknown>);
    expect((result as Record<string, unknown>).baseUrl).toBe('http://localhost:7213');
  });

  test('merges custom fetch into config', () => {
    const result = createClientConfig({} as Record<string, unknown>);
    expect(typeof (result as Record<string, unknown>).fetch).toBe('function');
  });

  test('baseUrl reflects updated value after setSdkBaseUrl', () => {
    setSdkBaseUrl('http://api.example.com:8080');
    const result = createClientConfig({} as Record<string, unknown>);
    expect((result as Record<string, unknown>).baseUrl).toBe('http://api.example.com:8080');
  });

  test('overrides any baseUrl present in incoming config', () => {
    const input = { baseUrl: 'http://stale.url' } as Record<string, unknown>;
    const result = createClientConfig(input);
    // The spread puts our baseUrl after — it wins
    expect((result as Record<string, unknown>).baseUrl).toBe('http://localhost:7213');
  });
});

// -------------------------------------------------------------------------
// setSdkBaseUrl / getSdkBaseUrl
// -------------------------------------------------------------------------

describe('setSdkBaseUrl / getSdkBaseUrl', () => {
  test('getSdkBaseUrl returns current base URL', () => {
    setSdkBaseUrl('http://localhost:7213');
    expect(getSdkBaseUrl()).toBe('http://localhost:7213');
  });

  test('setSdkBaseUrl updates the value', () => {
    setSdkBaseUrl('https://prod.api.com');
    expect(getSdkBaseUrl()).toBe('https://prod.api.com');
    // Restore
    setSdkBaseUrl('http://localhost:7213');
  });
});
