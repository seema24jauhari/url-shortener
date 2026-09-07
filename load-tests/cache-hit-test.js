// cache-hit-test.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 200,
  duration: '30s',
};

export default function () {
  // hit the SAME code repeatedly — should be a Redis cache hit every time after the first
  const res = http.get('http://localhost:3000/dddfgfggggg', { redirects: 0 });
  check(res, { 'status is 302': (r) => r.status === 302 });
}