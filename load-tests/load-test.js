// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // ramp up to 100 virtual users
    { duration: '1m', target: 500 },    // ramp up to 500
    { duration: '1m', target: 1000 },   // push to 1000 concurrent users
    { duration: '30s', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],   // 95% of requests should be under 200ms
    http_req_failed: ['rate<0.01'],     // less than 1% failure rate
  },
};

const SHORT_CODES = ['dummy-01', 'dummy-02', 'dummy-04']; // real codes from your DB

export default function () {
  const code = SHORT_CODES[Math.floor(Math.random() * SHORT_CODES.length)];
  const res = http.get(`http://localhost:3000/${code}`, {
    redirects: 0, // don't follow the redirect, just measure the response itself
  });

  check(res, {
    'status is 302': (r) => r.status === 302,
    'has Location header': (r) => r.headers['Location'] !== undefined,
  });

  sleep(0.1); // small pause between requests per virtual user
}

