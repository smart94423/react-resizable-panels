import { isDevelopment } from "#is-development";
import { PanelData } from "./Panel";
import { DragState, PanelGroupContext, ResizeEvent } from "./PanelGroupContext";
import useIsomorphicLayoutEffect from "./hooks/useIsomorphicEffect";
import useUniqueId from "./hooks/useUniqueId";
import { useWindowSplitterPanelGroupBehavior } from "./hooks/useWindowSplitterPanelGroupBehavior";
import { Direction } from "./types";
import { adjustLayoutByDelta } from "./utils/adjustLayoutByDelta";
import { areEqual } from "./utils/arrays";
import { assert } from "./utils/assert";
import { calculateDeltaPercentage } from "./utils/calculateDeltaPercentage";
import { calculateUnsafeDefaultLayout } from "./utils/calculateUnsafeDefaultLayout";
import { callPanelCallbacks } from "./utils/callPanelCallbacks";
import { compareLayouts } from "./utils/compareLayouts";
import { computePanelFlexBoxStyle } from "./utils/computePanelFlexBoxStyle";
import { resetGlobalCursorStyle, setGlobalCursorStyle } from "./utils/cursor";
import debounce from "./utils/debounce";
import { determinePivotIndices } from "./utils/determinePivotIndices";
import { getResizeHandleElement } from "./utils/dom/getResizeHandleElement";
import { isKeyDown, isMouseEvent, isTouchEvent } from "./utils/events";
import { getResizeEventCursorPosition } from "./utils/getResizeEventCursorPosition";
import { initializeDefaultStorage } from "./utils/initializeDefaultStorage";
import {
  loadPanelGroupState,
  savePanelGroupState,
} from "./utils/serialization";
import { validatePanelConstraints } from "./utils/validatePanelConstraints";
import { validatePanelGroupLayout } from "./utils/validatePanelGroupLayout";
import {
  CSSProperties,
  ElementType,
  ForwardedRef,
  HTMLAttributes,
  PropsWithChildren,
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "./vendor/react";

const LOCAL_STORAGE_DEBOUNCE_INTERVAL = 100;

export type ImperativePanelGroupHandle = {
  getId: () => string;
  getLayout: () => number[];
  setLayout: (layout: number[]) => void;
};

export type PanelGroupStorage = {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
};

export type PanelGroupOnLayout = (layout: number[]) => void;

const defaultStorage: PanelGroupStorage = {
  getItem: (name: string) => {
    initializeDefaultStorage(defaultStorage);
    return defaultStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    initializeDefaultStorage(defaultStorage);
    defaultStorage.setItem(name, value);
  },
};

export type PanelGroupProps = Omit<HTMLAttributes<ElementType>, "id"> &
  PropsWithChildren<{
    autoSaveId?: string | null;
    className?: string;
    direction: Direction;
    id?: string | null;
    keyboardResizeBy?: number | null;
    onLayout?: PanelGroupOnLayout | null;
    storage?: PanelGroupStorage;
    style?: CSSProperties;
    tagName?: ElementType;
  }>;

const debounceMap: {
  [key: string]: typeof savePanelGroupState;
} = {};

function PanelGroupWithForwardedRef({
  autoSaveId = null,
  children,
  className: classNameFromProps = "",
  direction,
  forwardedRef,
  id: idFromProps = null,
  onLayout = null,
  keyboardResizeBy = null,
  storage = defaultStorage,
  style: styleFromProps,
  tagName: Type = "div",
  ...rest
}: PanelGroupProps & {
  forwardedRef: ForwardedRef<ImperativePanelGroupHandle>;
}) {
  const groupId = useUniqueId(idFromProps);

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [layout, setLayout] = useState<number[]>([]);

  const panelIdToLastNotifiedSizeMapRef = useRef<Record<string, number>>({});
  const panelSizeBeforeCollapseRef = useRef<Map<string, number>>(new Map());
  const prevDeltaRef = useRef<number>(0);

  const committedValuesRef = useRef<{
    autoSaveId: string | null;
    direction: Direction;
    dragState: DragState | null;
    id: string;
    keyboardResizeBy: number | null;
    onLayout: PanelGroupOnLayout | null;
    storage: PanelGroupStorage;
  }>({
    autoSaveId,
    direction,
    dragState,
    id: groupId,
    keyboardResizeBy,
    onLayout,
    storage,
  });

  const eagerValuesRef = useRef<{
    layout: number[];
    panelDataArray: PanelData[];
    panelDataArrayChanged: boolean;
  }>({
    layout,
    panelDataArray: [],
    panelDataArrayChanged: false,
  });

  const devWarningsRef = useRef<{
    didLogIdAndOrderWarning: boolean;
    didLogPanelConstraintsWarning: boolean;
    prevPanelIds: string[];
  }>({
    didLogIdAndOrderWarning: false,
    didLogPanelConstraintsWarning: false,
    prevPanelIds: [],
  });

  useImperativeHandle(
    forwardedRef,
    () => ({
      getId: () => committedValuesRef.current.id,
      getLayout: () => {
        const { layout } = eagerValuesRef.current;

        return layout;
      },
      setLayout: (unsafeLayout: number[]) => {
        const { onLayout } = committedValuesRef.current;
        const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

        const safeLayout = validatePanelGroupLayout({
          layout: unsafeLayout,
          panelConstraints: panelDataArray.map(
            (panelData) => panelData.constraints
          ),
        });

        if (!areEqual(prevLayout, safeLayout)) {
          setLayout(safeLayout);

          eagerValuesRef.current.layout = safeLayout;

          if (onLayout) {
            onLayout(safeLayout);
          }

          callPanelCallbacks(
            panelDataArray,
            safeLayout,
            panelIdToLastNotifiedSizeMapRef.current
          );
        }
      },
    }),
    []
  );

  useIsomorphicLayoutEffect(() => {
    committedValuesRef.current.autoSaveId = autoSaveId;
    committedValuesRef.current.direction = direction;
    committedValuesRef.current.dragState = dragState;
    committedValuesRef.current.id = groupId;
    committedValuesRef.current.onLayout = onLayout;
    committedValuesRef.current.storage = storage;
  });

  useWindowSplitterPanelGroupBehavior({
    committedValuesRef,
    eagerValuesRef,
    groupId,
    layout,
    panelDataArray: eagerValuesRef.current.panelDataArray,
    setLayout,
  });

  useEffect(() => {
    const { panelDataArray } = eagerValuesRef.current;

    // If this panel has been configured to persist sizing information, save sizes to local storage.
    if (autoSaveId) {
      if (layout.length === 0 || layout.length !== panelDataArray.length) {
        return;
      }

      let debouncedSave = debounceMap[autoSaveId];

      // Limit the frequency of localStorage updates.
      if (debouncedSave == null) {
        debouncedSave = debounce(
          savePanelGroupState,
          LOCAL_STORAGE_DEBOUNCE_INTERVAL
        );

        debounceMap[autoSaveId] = debouncedSave;
      }

      // Clone mutable data before passing to the debounced function,
      // else we run the risk of saving an incorrect combination of mutable and immutable values to state.
      const clonedPanelDataArray = [...panelDataArray];
      const clonedPanelSizesBeforeCollapse = new Map(
        panelSizeBeforeCollapseRef.current
      );
      debouncedSave(
        autoSaveId,
        clonedPanelDataArray,
        clonedPanelSizesBeforeCollapse,
        layout,
        storage
      );
    }
  }, [autoSaveId, layout, storage]);

  // DEV warnings
  useEffect(() => {
    if (isDevelopment) {
      const { panelDataArray } = eagerValuesRef.current;

      const {
        didLogIdAndOrderWarning,
        didLogPanelConstraintsWarning,
        prevPanelIds,
      } = devWarningsRef.current;

      if (!didLogIdAndOrderWarning) {
        const panelIds = panelDataArray.map(({ id }) => id);

        devWarningsRef.current.prevPanelIds = panelIds;

        const panelsHaveChanged =
          prevPanelIds.length > 0 && !areEqual(prevPanelIds, panelIds);
        if (panelsHaveChanged) {
          if (
            panelDataArray.find(
              ({ idIsFromProps, order }) => !idIsFromProps || order == null
            )
          ) {
            devWarningsRef.current.didLogIdAndOrderWarning = true;

            console.warn(
              `WARNING: Panel id and order props recommended when panels are dynamically rendered`
            );
          }
        }
      }

      if (!didLogPanelConstraintsWarning) {
        const panelConstraints = panelDataArray.map(
          (panelData) => panelData.constraints
        );

        for (
          let panelIndex = 0;
          panelIndex < panelConstraints.length;
          panelIndex++
        ) {
          const panelData = panelDataArray[panelIndex];
          assert(panelData);

          const isValid = validatePanelConstraints({
            panelConstraints,
            panelId: panelData.id,
            panelIndex,
          });

          if (!isValid) {
            devWarningsRef.current.didLogPanelConstraintsWarning = true;

            break;
          }
        }
      }
    }
  });

  // External APIs are safe to memoize via committed values ref
  const collapsePanel = useCallback((panelData: PanelData) => {
    const { onLayout } = committedValuesRef.current;
    const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

    if (panelData.constraints.collapsible) {
      const panelConstraintsArray = panelDataArray.map(
        (panelData) => panelData.constraints
      );

      const {
        collapsedSize = 0,
        panelSize,
        pivotIndices,
      } = panelDataHelper(panelDataArray, panelData, prevLayout);

      assert(panelSize != null);

      if (panelSize !== collapsedSize) {
        // Store size before collapse;
        // This is the size that gets restored if the expand() API is used.
        panelSizeBeforeCollapseRef.current.set(panelData.id, panelSize);

        const isLastPanel =
          findPanelDataIndex(panelDataArray, panelData) ===
          panelDataArray.length - 1;
        const delta = isLastPanel
          ? panelSize - collapsedSize
          : collapsedSize - panelSize;

        const nextLayout = adjustLayoutByDelta({
          delta,
          layout: prevLayout,
          panelConstraints: panelConstraintsArray,
          pivotIndices,
          trigger: "imperative-api",
        });

        if (!compareLayouts(prevLayout, nextLayout)) {
          setLayout(nextLayout);

          eagerValuesRef.current.layout = nextLayout;

          if (onLayout) {
            onLayout(nextLayout);
          }

          callPanelCallbacks(
            panelDataArray,
            nextLayout,
            panelIdToLastNotifiedSizeMapRef.current
          );
        }
      }
    }
  }, []);

  // External APIs are safe to memoize via committed values ref
  const expandPanel = useCallback((panelData: PanelData) => {
    const { onLayout } = committedValuesRef.current;
    const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

    if (panelData.constraints.collapsible) {
      const panelConstraintsArray = panelDataArray.map(
        (panelData) => panelData.constraints
      );

      const {
        collapsedSize = 0,
        panelSize,
        minSize = 0,
        pivotIndices,
      } = panelDataHelper(panelDataArray, panelData, prevLayout);

      if (panelSize === collapsedSize) {
        // Restore this panel to the size it was before it was collapsed, if possible.
        const prevPanelSize = panelSizeBeforeCollapseRef.current.get(
          panelData.id
        );

        const baseSize =
          prevPanelSize != null && prevPanelSize >= minSize
            ? prevPanelSize
            : minSize;

        const isLastPanel =
          findPanelDataIndex(panelDataArray, panelData) ===
          panelDataArray.length - 1;
        const delta = isLastPanel ? panelSize - baseSize : baseSize - panelSize;

        const nextLayout = adjustLayoutByDelta({
          delta,
          layout: prevLayout,
          panelConstraints: panelConstraintsArray,
          pivotIndices,
          trigger: "imperative-api",
        });

        if (!compareLayouts(prevLayout, nextLayout)) {
          setLayout(nextLayout);

          eagerValuesRef.current.layout = nextLayout;

          if (onLayout) {
            onLayout(nextLayout);
          }

          callPanelCallbacks(
            panelDataArray,
            nextLayout,
            panelIdToLastNotifiedSizeMapRef.current
          );
        }
      }
    }
  }, []);

  // External APIs are safe to memoize via committed values ref
  const getPanelSize = useCallback((panelData: PanelData) => {
    const { layout, panelDataArray } = eagerValuesRef.current;

    const { panelSize } = panelDataHelper(panelDataArray, panelData, layout);

    assert(panelSize != null);

    return panelSize;
  }, []);

  // This API should never read from committedValuesRef
  const getPanelStyle = useCallback(
    (panelData: PanelData, defaultSize: number | undefined) => {
      const { panelDataArray } = eagerValuesRef.current;

      const panelIndex = findPanelDataIndex(panelDataArray, panelData);

      return computePanelFlexBoxStyle({
        defaultSize,
        dragState,
        layout,
        panelData: panelDataArray,
        panelIndex,
      });
    },
    [dragState, layout]
  );

  // External APIs are safe to memoize via committed values ref
  const isPanelCollapsed = useCallback((panelData: PanelData) => {
    const { layout, panelDataArray } = eagerValuesRef.current;

    const {
      collapsedSize = 0,
      collapsible,
      panelSize,
    } = panelDataHelper(panelDataArray, panelData, layout);

    return collapsible === true && panelSize === collapsedSize;
  }, []);

  // External APIs are safe to memoize via committed values ref
  const isPanelExpanded = useCallback((panelData: PanelData) => {
    const { layout, panelDataArray } = eagerValuesRef.current;

    const {
      collapsedSize = 0,
      collapsible,
      panelSize,
    } = panelDataHelper(panelDataArray, panelData, layout);

    assert(panelSize != null);

    return !collapsible || panelSize > collapsedSize;
  }, []);

  const registerPanel = useCallback((panelData: PanelData) => {
    const { panelDataArray } = eagerValuesRef.current;

    panelDataArray.push(panelData);
    panelDataArray.sort((panelA, panelB) => {
      const orderA = panelA.order;
      const orderB = panelB.order;
      if (orderA == null && orderB == null) {
        return 0;
      } else if (orderA == null) {
        return -1;
      } else if (orderB == null) {
        return 1;
      } else {
        return orderA - orderB;
      }
    });

    eagerValuesRef.current.panelDataArrayChanged = true;
  }, []);

  // (Re)calculate group layout whenever panels are registered or unregistered.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useIsomorphicLayoutEffect(() => {
    if (eagerValuesRef.current.panelDataArrayChanged) {
      eagerValuesRef.current.panelDataArrayChanged = false;

      const { autoSaveId, onLayout, storage } = committedValuesRef.current;
      const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

      // If this panel has been configured to persist sizing information,
      // default size should be restored from local storage if possible.
      let unsafeLayout: number[] | null = null;
      if (autoSaveId) {
        const state = loadPanelGroupState(autoSaveId, panelDataArray, storage);
        if (state) {
          panelSizeBeforeCollapseRef.current = new Map(
            Object.entries(state.expandToSizes)
          );
          unsafeLayout = state.layout;
        }
      }

      if (unsafeLayout == null) {
        unsafeLayout = calculateUnsafeDefaultLayout({
          panelDataArray,
        });
      }

      // Validate even saved layouts in case something has changed since last render
      // e.g. for pixel groups, this could be the size of the window
      const nextLayout = validatePanelGroupLayout({
        layout: unsafeLayout,
        panelConstraints: panelDataArray.map(
          (panelData) => panelData.constraints
        ),
      });

      if (!areEqual(prevLayout, nextLayout)) {
        setLayout(nextLayout);

        eagerValuesRef.current.layout = nextLayout;

        if (onLayout) {
          onLayout(nextLayout);
        }

        callPanelCallbacks(
          panelDataArray,
          nextLayout,
          panelIdToLastNotifiedSizeMapRef.current
        );
      }
    }
  });

  const registerResizeHandle = useCallback((dragHandleId: string) => {
    return function resizeHandler(event: ResizeEvent) {
      event.preventDefault();

      const {
        direction,
        dragState,
        id: groupId,
        keyboardResizeBy,
        onLayout,
      } = committedValuesRef.current;
      const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

      const { initialLayout } = dragState ?? {};

      const pivotIndices = determinePivotIndices(groupId, dragHandleId);

      let delta = calculateDeltaPercentage(
        event,
        dragHandleId,
        direction,
        dragState,
        keyboardResizeBy
      );
      if (delta === 0) {
        return;
      }

      // Support RTL layouts
      const isHorizontal = direction === "horizontal";
      if (document.dir === "rtl" && isHorizontal) {
        delta = -delta;
      }

      const panelConstraints = panelDataArray.map(
        (panelData) => panelData.constraints
      );

      const nextLayout = adjustLayoutByDelta({
        delta,
        layout: initialLayout ?? prevLayout,
        panelConstraints,
        pivotIndices,
        trigger: isKeyDown(event) ? "keyboard" : "mouse-or-touch",
      });

      const layoutChanged = !compareLayouts(prevLayout, nextLayout);

      // Only update the cursor for layout changes triggered by touch/mouse events (not keyboard)
      // Update the cursor even if the layout hasn't changed (we may need to show an invalid cursor state)
      if (isMouseEvent(event) || isTouchEvent(event)) {
        // Watch for multiple subsequent deltas; this might occur for tiny cursor movements.
        // In this case, Panel sizes might not change–
        // but updating cursor in this scenario would cause a flicker.
        if (prevDeltaRef.current != delta) {
          prevDeltaRef.current = delta;

          if (!layoutChanged) {
            // If the pointer has moved too far to resize the panel any further,
            // update the cursor style for a visual clue.
            // This mimics VS Code behavior.

            if (isHorizontal) {
              setGlobalCursorStyle(
                delta < 0 ? "horizontal-min" : "horizontal-max"
              );
            } else {
              setGlobalCursorStyle(delta < 0 ? "vertical-min" : "vertical-max");
            }
          } else {
            // Reset the cursor style to the the normal resize cursor.
            setGlobalCursorStyle(isHorizontal ? "horizontal" : "vertical");
          }
        }
      }

      if (layoutChanged) {
        setLayout(nextLayout);

        eagerValuesRef.current.layout = nextLayout;

        if (onLayout) {
          onLayout(nextLayout);
        }

        callPanelCallbacks(
          panelDataArray,
          nextLayout,
          panelIdToLastNotifiedSizeMapRef.current
        );
      }
    };
  }, []);

  // External APIs are safe to memoize via committed values ref
  const resizePanel = useCallback(
    (panelData: PanelData, unsafePanelSize: number) => {
      const { onLayout } = committedValuesRef.current;

      const { layout: prevLayout, panelDataArray } = eagerValuesRef.current;

      const panelConstraintsArray = panelDataArray.map(
        (panelData) => panelData.constraints
      );

      const { panelSize, pivotIndices } = panelDataHelper(
        panelDataArray,
        panelData,
        prevLayout
      );

      assert(panelSize != null);

      const isLastPanel =
        findPanelDataIndex(panelDataArray, panelData) ===
        panelDataArray.length - 1;
      const delta = isLastPanel
        ? panelSize - unsafePanelSize
        : unsafePanelSize - panelSize;

      const nextLayout = adjustLayoutByDelta({
        delta,
        layout: prevLayout,
        panelConstraints: panelConstraintsArray,
        pivotIndices,
        trigger: "imperative-api",
      });

      if (!compareLayouts(prevLayout, nextLayout)) {
        setLayout(nextLayout);

        eagerValuesRef.current.layout = nextLayout;

        if (onLayout) {
          onLayout(nextLayout);
        }

        callPanelCallbacks(
          panelDataArray,
          nextLayout,
          panelIdToLastNotifiedSizeMapRef.current
        );
      }
    },
    []
  );

  const startDragging = useCallback(
    (dragHandleId: string, event: ResizeEvent) => {
      const { direction } = committedValuesRef.current;
      const { layout } = eagerValuesRef.current;

      const handleElement = getResizeHandleElement(dragHandleId);
      assert(handleElement);

      const initialCursorPosition = getResizeEventCursorPosition(
        direction,
        event
      );

      setDragState({
        dragHandleId,
        dragHandleRect: handleElement.getBoundingClientRect(),
        initialCursorPosition,
        initialLayout: layout,
      });
    },
    []
  );

  const stopDragging = useCallback(() => {
    resetGlobalCursorStyle();
    setDragState(null);
  }, []);

  const unregisterPanel = useCallback((panelData: PanelData) => {
    const { panelDataArray } = eagerValuesRef.current;

    const index = findPanelDataIndex(panelDataArray, panelData);
    if (index >= 0) {
      panelDataArray.splice(index, 1);

      // TRICKY
      // When a panel is removed from the group, we should delete the most recent prev-size entry for it.
      // If we don't do this, then a conditionally rendered panel might not call onResize when it's re-mounted.
      // Strict effects mode makes this tricky though because all panels will be registered, unregistered, then re-registered on mount.
      delete panelIdToLastNotifiedSizeMapRef.current[panelData.id];

      eagerValuesRef.current.panelDataArrayChanged = true;
    }
  }, []);

  const context = useMemo(
    () => ({
      collapsePanel,
      direction,
      dragState,
      expandPanel,
      getPanelSize,
      getPanelStyle,
      groupId,
      isPanelCollapsed,
      isPanelExpanded,
      registerPanel,
      registerResizeHandle,
      resizePanel,
      startDragging,
      stopDragging,
      unregisterPanel,
    }),
    [
      collapsePanel,
      dragState,
      direction,
      expandPanel,
      getPanelSize,
      getPanelStyle,
      groupId,
      isPanelCollapsed,
      isPanelExpanded,
      registerPanel,
      registerResizeHandle,
      resizePanel,
      startDragging,
      stopDragging,
      unregisterPanel,
    ]
  );

  const style: CSSProperties = {
    display: "flex",
    flexDirection: direction === "horizontal" ? "row" : "column",
    height: "100%",
    overflow: "hidden",
    width: "100%",
  };

  return createElement(
    PanelGroupContext.Provider,
    { value: context },
    createElement(Type, {
      ...rest,

      children,
      className: classNameFromProps,
      style: {
        ...style,
        ...styleFromProps,
      },

      // CSS selectors
      "data-panel-group": "",
      "data-panel-group-direction": direction,
      "data-panel-group-id": groupId,
    })
  );
}

export const PanelGroup = forwardRef<
  ImperativePanelGroupHandle,
  PanelGroupProps
>((props: PanelGroupProps, ref: ForwardedRef<ImperativePanelGroupHandle>) =>
  createElement(PanelGroupWithForwardedRef, { ...props, forwardedRef: ref })
);

PanelGroupWithForwardedRef.displayName = "PanelGroup";
PanelGroup.displayName = "forwardRef(PanelGroup)";

function findPanelDataIndex(panelDataArray: PanelData[], panelData: PanelData) {
  return panelDataArray.findIndex(
    (prevPanelData) =>
      prevPanelData === panelData || prevPanelData.id === panelData.id
  );
}

function panelDataHelper(
  panelDataArray: PanelData[],
  panelData: PanelData,
  layout: number[]
) {
  const panelConstraintsArray = panelDataArray.map(
    (panelData) => panelData.constraints
  );

  const panelIndex = findPanelDataIndex(panelDataArray, panelData);
  const panelConstraints = panelConstraintsArray[panelIndex];

  const isLastPanel = panelIndex === panelDataArray.length - 1;
  const pivotIndices = isLastPanel
    ? [panelIndex - 1, panelIndex]
    : [panelIndex, panelIndex + 1];

  const panelSize = layout[panelIndex];

  return {
    ...panelConstraints,
    panelSize,
    pivotIndices,
  };
}
