# Test Suite for the Modernized Backend

This repository contains two sets of Jest tests that exercise the legacy **authRouter** implementation against a mocked database layer.  The goal is to *characterize* what the existing code actually does so that any future rewrite can be proven equivalent.

## Running the Tests

```bash
# From the project root (modernized/)
npm test -- <path-to-test-file>
```

The default `npm test` command will run all tests in the repository.  If you want to focus on a single file, use:

```bash
npm test -- modernized/src/backend/auth/authRouter.test.ts
# or equivalence suite
npm test -- modernized/src/backend/auth/authRouter.equivalence.test.ts
```

All tests are written with **Jest** and rely on the `supertest` package to issue HTTP requests against an in‑memory Express instance.

## Test Coverage Summary

| File | Total Specs | Passed | Failed |
|------|--------------|-------|--------|
| authRouter.test.ts | 4 | ✅ 4 | ❌ 0 |
| authRouter.equivalence.test.ts | 22 | ✅ 22 | ❌ 0 |

The tests cover:
* Successful and failed user setup via `/setup`.
* Authentication logic through `/login` with both valid and invalid credentials.
* The health‑check endpoint `/check-setup`.
* Token refresh mechanics on `/refresh`.
* Resetting the authentication state via `/reset`.

All tests run deterministically because database interactions are mocked using `jest.mock('../db')`, and bcrypt comparisons are stubbed as needed.

## Adding New Tests
If you add new legacy endpoints or modify existing ones, follow these steps:
1. Create a corresponding `.test.ts` file under the same directory.
2. Mock any external modules (`../db`, `bcrypt`, etc.) at the top of your test file.
3. Use `supertest` to send requests and assert on responses.
4. Run the full suite or just your new tests to ensure coverage.

## Notes for Future Rewrite
* The legacy code uses a **plain Express router** with synchronous error handling – any rewrite should preserve this contract.
* Tokens are signed with `process.env.JWT_SECRET`.  Tests set a deterministic secret so that JWTs can be decoded and verified if needed.
* All responses use JSON objects; the tests assert on status codes, presence of keys (`success`, `error`, `token`), and where applicable the payload shape.

---