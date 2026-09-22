"use client";

import type { ReactNode } from "react";
import { Tab, TabList, TabPanel, Tabs as AriaTabs } from "react-aria-components";

/**
 * Tabs switch views of one object on one page, for example the marking panel's Rubric, Feedback, Integrity and
 * History (design system 4.7). Built on React Aria: arrow keys move between tabs, Home and End go to the ends, and
 * only the selected tab is in the Tab order. For separate pages, use Subnav instead.
 */

export interface TabItem {
  id: string;
  label: string;
  /** A count after the label, for example integrity events to review. */
  count?: number;
  content: ReactNode;
}

export function Tabs({ label, tabs, defaultSelected }: { label: string; tabs: TabItem[]; defaultSelected?: string }) {
  return (
    <AriaTabs className="tabs" defaultSelectedKey={defaultSelected ?? tabs[0]?.id}>
      <TabList aria-label={label} className="tabs__list">
        {tabs.map((tab) => (
          <Tab className="tabs__tab" id={tab.id} key={tab.id}>
            {tab.label}
            {/* The space keeps the count a separate word in the tab's name ("History 2"); flex layout ignores it. */}
            {tab.count !== undefined ? (
              <>
                {" "}
                <span className="tabs__count">{tab.count}</span>
              </>
            ) : null}
          </Tab>
        ))}
      </TabList>
      {tabs.map((tab) => (
        <TabPanel className="tabs__panel" id={tab.id} key={tab.id}>
          {tab.content}
        </TabPanel>
      ))}
    </AriaTabs>
  );
}
