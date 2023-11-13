import { PanelConstraints } from "../Panel";
import { computePercentagePanelConstraints } from "./computePercentagePanelConstraints";
import { fuzzyCompareNumbers } from "./numbers/fuzzyCompareNumbers";

// Panel size must be in percentages; pixel values should be pre-converted
export function resizePanel({
  groupSizePixels,
  panelConstraints,
  panelIndex,
  size,
}: {
  groupSizePixels: number;
  panelConstraints: PanelConstraints[];
  panelIndex: number;
  size: number;
}) {
  const hasPixelConstraints = panelConstraints.some(
    ({
      collapsedSizePixels,
      defaultSizePixels,
      minSizePixels,
      maxSizePixels,
    }) =>
      collapsedSizePixels != null ||
      defaultSizePixels != null ||
      minSizePixels != null ||
      maxSizePixels != null
  );

  if (hasPixelConstraints && groupSizePixels <= 0) {
    console.warn(`WARNING: Invalid group size: ${groupSizePixels}px`);

    return 0;
  }

  let { collapsible } = panelConstraints[panelIndex]!;

  const { collapsedSizePercentage, maxSizePercentage, minSizePercentage } =
    computePercentagePanelConstraints(
      panelConstraints,
      panelIndex,
      groupSizePixels
    );

  if (minSizePercentage != null) {
    if (fuzzyCompareNumbers(size, minSizePercentage) < 0) {
      if (collapsible) {
        size = collapsedSizePercentage;
      } else {
        size = minSizePercentage;
      }
    }
  }

  if (maxSizePercentage != null) {
    size = Math.min(maxSizePercentage, size);
  }

  return size;
}
