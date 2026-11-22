/**
 * Unit tests for the paging pipes (`?page=` / `?limit=`).
 *
 * The e2e tests (test/paging.e2e-spec.ts) check that every list endpoint uses
 * them; these tests check the rules themselves, including edge cases that are
 * awkward to send over HTTP.
 *
 * Run with: npm test
 */
import { BadRequestException } from '@nestjs/common';
import { MAX_PAGE_LIMIT, ParseLimitPipe, ParsePagePipe } from './paging.pipes';

describe('ParsePagePipe', () => {
  const pipe = new ParsePagePipe();

  it.each([
    ['1', 1],
    ['42', 42],
    [' 7 ', 7], // surrounding spaces are tolerated
  ])('accepts %p as %p', (input, expected) => {
    expect(pipe.transform(input)).toBe(expected);
  });

  it.each([
    ['0'],
    ['-1'],
    ['1.5'],
    ['1e2'], // would be 100 for Number(), but it is not plain digits
    ['12abc'], // would be 12 for parseInt()
    [''],
    [undefined], // the parameter is missing
  ])('rejects %p with 400', (input) => {
    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });
});

describe('ParseLimitPipe', () => {
  const pipe = new ParseLimitPipe();

  it('accepts 1 and the maximum', () => {
    expect(pipe.transform('1')).toBe(1);
    expect(pipe.transform(String(MAX_PAGE_LIMIT))).toBe(MAX_PAGE_LIMIT);
  });

  it.each([['0'], ['-5'], [String(MAX_PAGE_LIMIT + 1)], ['abc']])(
    'rejects %p with 400',
    (input) => {
      expect(() => pipe.transform(input)).toThrow(BadRequestException);
    },
  );
});
