import { useRef, useState } from "react";
import type {
  ImperativePanelGroupHandle,
  MixedSizes,
} from "react-resizable-panels";
import { Panel, PanelGroup } from "react-resizable-panels";

import { ResizeHandle } from "../../components/ResizeHandle";

import Code from "../../components/Code";
import Example from "./Example";
import styles from "./ImperativePanelGroupApi.module.css";
import sharedStyles from "./shared.module.css";

export default function ImperativePanelGroupApiRoute() {
  return (
    <Example
      code={CODE}
      exampleNode={<Content />}
      headerNode={
        <>
          <p>
            <code>PanelGroup</code> provides the following imperative API
            methods:
          </p>
          <ul>
            <li>
              <Code
                className={sharedStyles.InlineCode}
                code={`getId(): string`}
                language="typescript"
              />
              Panel group id
            </li>
            <li>
              <Code
                className={sharedStyles.InlineCode}
                code={`getLayout(): MixedSizes[]`}
                language="typescript"
              />
              Current size of panels (in both percentage and pixel units)
            </li>
            <li>
              <Code
                className={sharedStyles.InlineCode}
                code={`setLayout(Partial<MixedSizes>[]): void`}
                language="typescript"
              />
              Resize all panels (using either percentage or pixel units)
            </li>
          </ul>
          <p>
            Note that the <code>MixedSizes</code> type above is defined as{" "}
            <Code
              className={sharedStyles.InlineCode}
              code={`{ sizePercentage: number; sizePixels: number; }`}
              language="typescript"
            />
          </p>
        </>
      }
      language="tsx"
      title="Imperative PanelGroup API"
    />
  );
}

function Content() {
  const [sizes, setSizes] = useState<number[]>([]);

  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);

  const onLayout = (mixedSizes: MixedSizes[]) => {
    setSizes(mixedSizes.map((mixedSize) => mixedSize.sizePercentage));
  };

  const resetLayout = () => {
    const panelGroup = panelGroupRef.current;
    if (panelGroup) {
      panelGroup.setLayout([{ sizePercentage: 50 }, { sizePercentage: 50 }]);
    }
  };

  return (
    <>
      <div className={styles.TopRow}>
        <button className={sharedStyles.Button} onClick={resetLayout}>
          Reset layout
        </button>
      </div>
      <div className={sharedStyles.PanelGroupWrapper}>
        <PanelGroup
          className={sharedStyles.PanelGroup}
          direction="horizontal"
          id="imperative-PanelGroup-api"
          onLayout={onLayout}
          ref={panelGroupRef}
        >
          <Panel className={sharedStyles.PanelRow} minSizePercentage={10}>
            <div className={sharedStyles.Centered}>
              left: {Math.round(sizes[0])}
            </div>
          </Panel>
          <ResizeHandle className={sharedStyles.ResizeHandle} />
          <Panel className={sharedStyles.PanelRow} minSizePercentage={10}>
            <div className={sharedStyles.Centered}>
              right: {Math.round(sizes[1])}
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </>
  );
}

const CODE = `
import {
  ImperativePanelGroupHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

const ref = useRef<ImperativePanelGroupHandle>(null);

const resetLayout = () => {
  const panelGroup = ref.current;
  if (panelGroup) {
    // Reset each Panel to 50% of the group's width
    panelGroup.setLayout([50, 50]);
  }
};

<PanelGroup direction="horizontal" ref={ref}>
  <Panel>left</Panel>
  <PanelResizeHandle />
  <Panel>right</Panel>
</PanelGroup>
`;
