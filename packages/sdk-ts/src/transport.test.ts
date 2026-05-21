import { describe, test, expect } from 'bun:test';
import {
  HttpTransport,
  setHttpBaseUrl,
  getTransport,
  getTransportInfo,
} from './transport';

describe('Transport', () => {
  describe('HttpTransport', () => {
    test('constructs with base URL', () => {
      const transport = new HttpTransport('http://localhost:3000');
      expect(transport).toBeDefined();
    });
  });

  describe('setHttpBaseUrl', () => {
    test('updates base URL', () => {
      setHttpBaseUrl('http://example.com:8080');
      const info = getTransportInfo();
      expect(info.baseUrl).toBe('http://example.com:8080');
    });
  });

  describe('getTransport', () => {
    test('returns HttpTransport', () => {
      const transport = getTransport();
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    test('returns same instance on subsequent calls', () => {
      const transport1 = getTransport();
      const transport2 = getTransport();
      expect(transport1).toBe(transport2);
    });
  });

  describe('getTransportInfo', () => {
    test('returns correct info structure', () => {
      setHttpBaseUrl('http://localhost:7213');

      const info = getTransportInfo();

      expect(info).toEqual({
        active: 'http',
        baseUrl: 'http://localhost:7213',
      });
    });
  });
});
