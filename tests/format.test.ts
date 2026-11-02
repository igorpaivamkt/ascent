import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNumber } from '../src/utils/format';

describe('entrada numérica pt-BR', () => {
  it('interpreta separadores brasileiros', () => {
    assert.equal(parseNumber('1.200'), 1200);
    assert.equal(parseNumber('5.400'), 5400);
    assert.equal(parseNumber('1.234,56'), 1234.56);
    assert.equal(parseNumber('250,90'), 250.9);
    assert.equal(parseNumber('R$ 3.500'), 3500);
    assert.equal(parseNumber('12'), 12);
    assert.equal(parseNumber('1234.5'), 1234.5);
    assert.equal(parseNumber('0,5'), 0.5);
  });
  it('rejeita texto inválido', () => {
    assert.ok(Number.isNaN(parseNumber('abc')));
    assert.ok(Number.isNaN(parseNumber('')));
  });
});
