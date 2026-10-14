/**
 * Squishmoji engine — ported from @usespaceui/squishmoji (MIT, SpaceUI).
 * 21 body shapes × 22 expressions × 6 generative backgrounds.
 */
export { resolveLayout, buildLayout } from './engine/layout'
export { renderLayout, createAvatar as createSquishmoji } from './core/render'
export { capsulePath } from './core/geometry'
export {
  resolveShape,
  resolveExpression,
  resolveBackgroundStyle,
} from './core/resolve'
export { SquishEngine } from './engine/animation'
export {
  DEFAULT_SEED,
  SquishOutputFormat,
  SHAPES,
  EXPRESSIONS,
  BACKGROUND_STYLES,
  SHAPE_LIST,
  EXPRESSION_LIST,
  BACKGROUND_STYLE_LIST,
  SHAPE_VALUES,
  EXPRESSION_VALUES,
  BACKGROUND_STYLE_VALUES,
  DEFAULT_SHAPE,
  DEFAULT_EXPRESSION,
  DEFAULT_BACKGROUND_STYLE,
} from './types'
export type {
  SquishShape,
  SquishExpression,
  SquishBackgroundStyle,
  SquishShapeChoice,
  SquishExpressionChoice,
  SquishBackgroundStyleChoice,
  SquishCatalogPick,
  SquishOptions,
  SquishJson,
  SquishLayout,
  SquishTraits,
} from './types'
