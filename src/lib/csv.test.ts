import { describe, expect, it } from 'vitest'
import { parseSimpleCsv } from './csv'

describe('parseSimpleCsv', () => {
  it('keys each row by the header, dropping a byte-order mark and blank lines', () => {
    expect(parseSimpleCsv('﻿tsc,lane,ct\r\n101,1,40\r\n\r\n102,2,\n')).toEqual([
      { tsc: '101', lane: '1', ct: '40' },
      { tsc: '102', lane: '2', ct: '' },
    ])
  })

  it('fills short rows with empty cells, and reads an empty file as no rows', () => {
    expect(parseSimpleCsv('a,b\n1')).toEqual([{ a: '1', b: '' }])
    expect(parseSimpleCsv('')).toEqual([])
  })
})
