import { DragState, ResizeEvent } from "../PanelGroupContext";
import { Direction } from "../types";
import { assert } from "./assert";
import { getPanelGroupElement } from "./dom/getPanelGroupElement";
import { getResizeHandleElement } from "./dom/getResizeHandleElement";
import { getResizeEventCursorPosition } from "./getResizeEventCursorPosition";

export function calculateDragOffsetPercentage(
  event: ResizeEvent,
  dragHandleId: string,
  direction: Direction,
  initialDragState: DragState
): number {
  const isHorizontal = direction === "horizontal";

  const handleElement = getResizeHandleElement(dragHandleId);
  assert(handleElement);

  const groupId = handleElement.getAttribute("data-panel-group-id");
  assert(groupId);

  let { initialCursorPosition } = initialDragState;

  const cursorPosition = getResizeEventCursorPosition(direction, event);

  const groupElement = getPanelGroupElement(groupId);
  assert(groupElement);

  const groupRect = groupElement.getBoundingClientRect();
  const groupSizeInPixels = isHorizontal ? groupRect.width : groupRect.height;

  const offsetPixels = cursorPosition - initialCursorPosition;
  const offsetPercentage = (offsetPixels / groupSizeInPixels) * 100;

  return offsetPercentage;
}
