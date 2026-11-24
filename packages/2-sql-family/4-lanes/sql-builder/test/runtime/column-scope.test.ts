import {
  AndExpr,
  ColumnRef,
  ExistsExpr,
  SelectAst,
  TableSource,
} from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { assertColumnsInScope } from '../../src/runtime/column-scope';

describe('assertColumnsInScope', () => {
  it('reports the first invalid column in traversal order', () => {
    const ast = SelectAst.from(TableSource.named('visible')).withWhere(
      AndExpr.of([
        ColumnRef.of('first_missing', 'first'),
        ColumnRef.of('second_missing', 'second'),
      ]),
    );

    expect(() => assertColumnsInScope(ast)).toThrow(
      expect.objectContaining({
        code: 'ORM.ARGUMENT_INVALID',
        meta: { alias: 'first_missing', column: 'first', sources: ['visible'] },
      }),
    );
  });

  it('validates nested subqueries with their inner and outer sources visible', () => {
    const subquery = SelectAst.from(TableSource.named('inner')).withWhere(
      AndExpr.of([
        ColumnRef.of('inner', 'inner_id'),
        ColumnRef.of('outer', 'outer_id'),
        ColumnRef.of('missing', 'missing_id'),
      ]),
    );
    const ast = SelectAst.from(TableSource.named('outer')).withWhere(ExistsExpr.exists(subquery));

    expect(() => assertColumnsInScope(ast)).toThrow(
      expect.objectContaining({
        code: 'ORM.ARGUMENT_INVALID',
        meta: { alias: 'missing', column: 'missing_id', sources: ['outer', 'inner'] },
      }),
    );
  });
});
