import { colorsFor } from "../palette";
import { paletteSeed } from "../core/rng";
import { bodyPath } from "../core/geometry";
import { resolveExpression, resolveShape } from "../core/resolve";
import { traitsFor, fitEyesToShape, type FittedEye } from "./face";
import { shapeGeometry, type ShapeGeometry } from "./shapes";
import { expressionPose, type ExpressionPose } from "./expressions";
import { type DuoLayout, type DuoOptions } from "../types";

export function resolveLayout(
  name: string,
  options: DuoOptions = {},
): DuoLayout {
  const base = traitsFor(name);
  return buildLayout(
    name,
    shapeGeometry(base, resolveShape(name, options.shape)),
    expressionPose(resolveExpression(name, options.expression)),
    undefined,
    options.colors,
  );
}

export function buildLayout(
  name: string,
  geometry: ShapeGeometry,
  expression: ExpressionPose,
  adjustEyes?: (eyes: FittedEye[]) => FittedEye[],
  colors?: readonly string[],
): DuoLayout {
  const traits = geometry.traits;
  const resolvedColors = colorsFor(name, colors);
  const eyes = [-1, 1].map((_, index) => {
    const pose = index === 0 ? expression.left : expression.right;
    const other = index === 0 ? expression.right : expression.left;
    const center = (pose.matrix[4] + other.matrix[4]) / 2;
    const matrix = [...pose.matrix] as typeof pose.matrix;
    matrix[4] = center + (matrix[4] - center) * (traits.eyeGap / 0.49);
    matrix[5] += traits.eyeHeight * 100;
    return {
      width: traits.eyeSize * pose.width,
      height: traits.eyeSize * pose.height,
      matrix,
    };
  });
  const adjustedEyes = adjustEyes ? adjustEyes(eyes) : eyes;
  return {
    seed: paletteSeed(name),
    traits,
    body: bodyPath(geometry.point),
    eyes: fitEyesToShape(geometry, adjustedEyes),
    colors: resolvedColors,
  };
}
