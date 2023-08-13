import { Panel, PanelGroup } from "react-resizable-panels";

import ResizeHandle from "../../components/ResizeHandle";

import { Link } from "react-router-dom";
import AutoSizer from "react-virtualized-auto-sizer";
import exampleStyles from "./Example.module.css";
import styles from "./PixelBasedLayouts.module.css";
import sharedStyles from "./shared.module.css";

import { PropsWithChildren } from "react";
import Code from "../../components/Code";
import Icon from "../../components/Icon";

export default function PixelBasedLayouts() {
  return (
    <div className={exampleStyles.Route}>
      <h1 className={exampleStyles.Header}>
        <Link className={exampleStyles.HomeLink} to="/">
          Home
        </Link>
        →<span className={exampleStyles.Title}>Pixel based layouts</span>
      </h1>
      <p>
        Resizable panels typically use percentage-based layout constraints, but
        pixel units are also supported via the <code>units</code> prop. The
        example below shows a horizontal panel group where the first panel is
        limited to a range of 100-200 pixels.
      </p>
      <p className={sharedStyles.WarningBlock}>
        <Icon className={sharedStyles.WarningIcon} type="warning" />
        Pixel units should only be used when necessary because they require more
        complex layout logic.
      </p>
      <div className={exampleStyles.ExampleContainer}>
        <div className={sharedStyles.PanelGroupWrapper} data-short>
          <PanelGroup
            className={sharedStyles.PanelGroup}
            direction="horizontal"
            units="pixels"
          >
            <Panel
              className={sharedStyles.PanelRow}
              minSize={100}
              maxSize={200}
            >
              <div className={styles.AutoSizerWrapper}>
                <Size direction="horizontal">
                  <p className={styles.Small}>100px - 200px</p>
                </Size>
              </div>
            </Panel>
            <ResizeHandle className={sharedStyles.ResizeHandle} />
            <Panel className={sharedStyles.PanelRow} minSize={10}>
              <div className={sharedStyles.Centered}>middle</div>
            </Panel>
            <ResizeHandle className={sharedStyles.ResizeHandle} />
            <Panel className={sharedStyles.PanelRow} minSize={10}>
              <div className={sharedStyles.Centered}>right</div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
      <Code
        className={exampleStyles.Code}
        code={CODE_HOOK.trim()}
        language="jsx"
        showLineNumbers
      />
      <div className={exampleStyles.ExampleContainer}>
        <p>
          Panels with pixel constraints can also be configured to collapse as
          shown below.
        </p>
      </div>
      <div className={exampleStyles.ExampleContainer}>
        <div className={sharedStyles.PanelGroupWrapper} data-short>
          <PanelGroup
            className={sharedStyles.PanelGroup}
            direction="horizontal"
            units="pixels"
          >
            <Panel className={sharedStyles.PanelRow} minSize={10}>
              <div className={sharedStyles.Centered}>left</div>
            </Panel>
            <ResizeHandle className={sharedStyles.ResizeHandle} />
            <Panel className={sharedStyles.PanelRow} minSize={10}>
              <div className={sharedStyles.Centered}>middle</div>
            </Panel>
            <ResizeHandle className={sharedStyles.ResizeHandle} />
            <Panel
              className={sharedStyles.PanelRow}
              collapsible={true}
              collapsedSize={75}
              minSize={200}
              maxSize={300}
            >
              <div className={styles.AutoSizerWrapper}>
                <Size direction="horizontal">
                  <p className={styles.Small}>200px - 300px</p>
                  <p className={styles.Small}>collapse below 100px</p>
                </Size>
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
      <Code
        className={exampleStyles.Code}
        code={CODE_HOOK_COLLAPSIBLE.trim()}
        language="jsx"
        showLineNumbers
      />
    </div>
  );
}

function Size({
  children,
  direction,
}: PropsWithChildren & {
  direction: "horizontal" | "vertical";
}) {
  return (
    <AutoSizer>
      {({ height, width }) => (
        <div
          className={styles.AutoSizerInner}
          style={{ height: `${height}px`, width: `${width}px` }}
        >
          <center>
            <p>{direction === "horizontal" ? width : height}px</p>
            {children}
          </center>
        </div>
      )}
    </AutoSizer>
  );
}

const CODE_HOOK = `
<PanelGroup direction="horizontal" units="pixels">
  <Panel minSize={100} maxSize={200} />
  <PanelResizeHandle />
  <Panel />
  <PanelResizeHandle />
  <Panel />
</PanelGroup>
`;

const CODE_HOOK_COLLAPSIBLE = `
<PanelGroup direction="horizontal" units="pixels">
  <Panel />
  <PanelResizeHandle />
  <Panel />
  <PanelResizeHandle />
  <Panel collapsible={true} collapsedSize={75} minSize={100} maxSize={200} />
</PanelGroup>
`;
